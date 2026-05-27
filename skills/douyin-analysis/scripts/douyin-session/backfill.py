"""Incrementally backfill Douyin deep metrics and Top comments.

Usage:
    python backfill.py --works outputs/douyin_works_final.json --out outputs/deep_metrics_progress.json
    python backfill.py --works ... --out ... --limit 3

The script resumes from the output file. It only fetches items missing deep metrics
or Top comments unless --force is passed.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import crawler


def _as_items(data: Any) -> list[dict]:
    if isinstance(data, list):
        return data
    if isinstance(data, dict):
        for key in ("publishedWorks", "works", "items", "results"):
            val = data.get(key)
            if isinstance(val, list):
                return val
    return []


def _present(value: Any) -> bool:
    if isinstance(value, list):
        return bool(value)
    if value is False or value == 0:
        return True
    return value is not None and str(value).strip() != ""


def _flatten(obj: Any, prefix: str = "") -> list[tuple[str, Any]]:
    rows: list[tuple[str, Any]] = []
    if isinstance(obj, dict):
        for key, value in obj.items():
            rows.extend(_flatten(value, f"{prefix}.{key}" if prefix else str(key)))
    elif isinstance(obj, list):
        for idx, value in enumerate(obj[:20]):
            rows.extend(_flatten(value, f"{prefix}[{idx}]"))
    else:
        rows.append((prefix, obj))
    return rows


def _matches(value: Any, patterns: tuple[str, ...]) -> bool:
    text = str(value).lower()
    return any(pattern in text for pattern in patterns)


def _primitive(value: Any) -> bool:
    return not isinstance(value, (dict, list))


def _pick_labeled_metric(obj: Any, patterns: tuple[str, ...]) -> Any:
    if isinstance(obj, dict):
        label_keys = {"name", "title", "label", "desc", "text", "metric_name", "indicator_name"}
        has_matching_label = any(
            str(key).lower() in label_keys and _primitive(value) and _matches(value, patterns)
            for key, value in obj.items()
        )
        if has_matching_label:
            for key in ("value", "val", "num", "count", "rate", "percent", "show_value", "display_value"):
                value = obj.get(key)
                if _present(value) and not _matches(value, patterns):
                    return value
            for key, value in obj.items():
                if key.lower() in ("name", "title", "label", "desc", "text", "metric_name", "indicator_name"):
                    continue
                if _primitive(value) and _present(value) and not _matches(value, patterns):
                    return value
        for value in obj.values():
            picked = _pick_labeled_metric(value, patterns)
            if _present(picked):
                return picked
    elif isinstance(obj, list):
        for value in obj:
            picked = _pick_labeled_metric(value, patterns)
            if _present(picked):
                return picked
    return None


def _pick_metric(flat: list[tuple[str, Any]], patterns: tuple[str, ...]) -> Any:
    for path, value in flat:
        low = path.lower()
        if any(pattern in low for pattern in patterns) and _present(value):
            return value
    return None


def _leaf(path: str) -> str:
    return path.replace("]", "").split(".")[-1].split("[")[0]


def _pick_exact_key(flat: list[tuple[str, Any]], names: tuple[str, ...]) -> Any:
    wanted = set(names)
    for path, value in flat:
        if _leaf(path) in wanted and _present(value):
            return value
    return None


def _pick_text_metric(text: str, patterns: tuple[str, ...]) -> Any:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    for idx, line in enumerate(lines):
        if not _matches(line, patterns):
            continue
        for candidate in lines[idx : idx + 4]:
            if re.search(r"\d", candidate):
                return candidate
    return None


def _parse_percent(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        num = float(value)
        ratio = num / 100 if num > 1 else num
        return ratio if 0 <= ratio <= 1 else None
    text = str(value).strip()
    match = re.search(r"-?\d+(?:\.\d+)?", text)
    if not match:
        return None
    num = float(match.group(0))
    ratio = num / 100 if "%" in text or num > 1 else num
    return ratio if 0 <= ratio <= 1 else None


def _parse_seconds(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value) / 1000 if value > 1000 else float(value)
    text = str(value).strip()
    colon = re.match(r"^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$", text)
    if colon:
        parts = [int(part) for part in colon.groups(default="0")]
        if colon.group(3) is None:
            return parts[0] * 60 + parts[1]
        return parts[0] * 3600 + parts[1] * 60 + parts[2]
    minute = re.search(r"(\d+(?:\.\d+)?)\s*分", text)
    second = re.search(r"(\d+(?:\.\d+)?)\s*(?:秒|s|sec)", text, re.I)
    if minute or second:
        return (float(minute.group(1)) * 60 if minute else 0) + (float(second.group(1)) if second else 0)
    match = re.search(r"\d+(?:\.\d+)?", text)
    return float(match.group(0)) if match else None


def _extract_metrics(detail: dict) -> dict:
    captured = detail.get("captured") or []
    payloads = [item.get("data") for item in captured if isinstance(item, dict)]
    flat: list[tuple[str, Any]] = []
    for payload in payloads:
        flat.extend(_flatten(payload))
    text = detail.get("text") or ""

    def pick(patterns: tuple[str, ...]) -> Any:
        for payload in payloads:
            value = _pick_labeled_metric(payload, patterns)
            if _present(value):
                return value
        value = _pick_metric(flat, patterns)
        if _present(value):
            return value
        return _pick_text_metric(text, patterns)

    metrics = {}
    exact_avg_watch = _pick_exact_key(flat, ("avg_view_second", "avg_watch_second", "avg_play_second"))
    exact_completion = _pick_exact_key(flat, ("completion_rate", "finish_rate", "play_over_rate"))
    exact_five_second = _pick_exact_key(flat, ("completion_rate_5s", "five_second_retention", "five_sec_retention"))
    exact_profile_visits = _pick_exact_key(flat, ("homepage_visit_count", "profile_visit_count"))
    exact_lost_followers = _pick_exact_key(flat, ("unsubscribe_count", "unfollow_count", "lost_followers"))
    exact_cover_click = _pick_exact_key(flat, ("cover_click_rate",))
    exact_favorites = _pick_exact_key(flat, ("favorite_count", "collect_count"))
    exact_shares = _pick_exact_key(flat, ("share_count",))
    exact_likes = _pick_exact_key(flat, ("like_count", "digg_count"))
    exact_comments = _pick_exact_key(flat, ("comment_count",))
    exact_plays = _pick_exact_key(flat, ("view_count", "play_count"))

    if _present(exact_avg_watch):
        metrics["avgWatchTimeText"] = str(exact_avg_watch)
        metrics["avgWatchTimeSeconds"] = _parse_seconds(exact_avg_watch)
    if _present(exact_completion):
        metrics["completionRateText"] = exact_completion
        metrics["completionRate"] = _parse_percent(exact_completion)
    if _present(exact_five_second):
        metrics["fiveSecondRetentionText"] = exact_five_second
        metrics["fiveSecondRetention"] = _parse_percent(exact_five_second)
    if _present(exact_profile_visits):
        metrics["profileVisits"] = exact_profile_visits
    if _present(exact_lost_followers):
        metrics["lostFollowers"] = exact_lost_followers
    if _present(exact_cover_click):
        metrics["coverClickRateText"] = exact_cover_click
        metrics["coverClickRate"] = _parse_percent(exact_cover_click)
    for key, value in (
        ("favorites", exact_favorites),
        ("shares", exact_shares),
        ("likes", exact_likes),
        ("comments", exact_comments),
        ("plays", exact_plays),
    ):
        if _present(value):
            metrics[key] = value

    fallback_metrics = {
        "avgWatchTimeText": pick(("avg_play", "average_play", "avg_watch", "average_watch", "平均播放", "平均观看", "播放时长", "观看时长")),
        "completionRateText": pick(("completion", "complete_rate", "finish", "play_over", "完播")),
        "threeSecondRetentionText": pick(("3s", "3_sec", "three_sec", "three_second", "3秒", "前三秒", "3 秒")),
        "fiveSecondRetentionText": pick(("5s", "5_sec", "five_sec", "five_second", "5秒", "5 秒")),
        "newFollowers": pick(("new_follow", "new_fans", "new_follower", "新增粉", "涨粉", "新增关注")),
        "lostFollowers": pick(("unsubscribe", "unfollow", "lost_follow", "脱粉", "取关")),
        "followRateText": pick(("follow_rate", "fans_rate", "follower_rate", "转粉率", "涨粉率", "关注率")),
        "profileVisits": pick(("profile_visit", "homepage_visit", "主页访问", "个人主页")),
    }
    for key, value in fallback_metrics.items():
        if key not in metrics and _present(value):
            metrics[key] = value
    metrics = {key: value for key, value in metrics.items() if _present(value)}
    if "avgWatchTimeText" in metrics:
        metrics["avgWatchTimeSeconds"] = _parse_seconds(metrics["avgWatchTimeText"])
    for text_key, numeric_key in (
        ("completionRateText", "completionRate"),
        ("threeSecondRetentionText", "threeSecondRetention"),
        ("fiveSecondRetentionText", "fiveSecondRetention"),
        ("followRateText", "followRate"),
    ):
        if text_key in metrics:
            metrics[numeric_key] = _parse_percent(metrics[text_key])
    return {key: value for key, value in metrics.items() if _present(value)}


def _normalize_comments(comments: list[dict], limit: int) -> list[dict]:
    rows = []
    for comment in comments[:limit]:
        rows.append(
            {
                "text": comment.get("text") or "",
                "diggCount": comment.get("digg_count") or 0,
                "replyCount": comment.get("reply_comment_total") or 0,
                "createTime": comment.get("create_time") or 0,
                "userName": comment.get("user_name") or "",
                "ipLabel": comment.get("ip_label") or "",
            }
        )
    return rows


def _has_rate_metric(metrics: dict, text_key: str, numeric_key: str) -> bool:
    value = metrics.get(numeric_key)
    if isinstance(value, (int, float)):
        return 0 <= float(value) <= 1
    if _present(metrics.get(text_key)):
        return _parse_percent(metrics.get(text_key)) is not None
    return False


def _has_complete_deep(record: dict) -> bool:
    metrics = record.get("metrics") or {}
    comments = record.get("topComments") or []
    has_comments = isinstance(comments, list) and len(comments) > 0
    has_core_metric = (
        _has_rate_metric(metrics, "completionRateText", "completionRate")
        or _has_rate_metric(metrics, "threeSecondRetentionText", "threeSecondRetention")
        or _has_rate_metric(metrics, "followRateText", "followRate")
        or _present(metrics.get("newFollowers"))
        or _present(metrics.get("lostFollowers"))
    )
    return record.get("status") == "ok" and has_comments and has_core_metric


def _record_key(row: dict) -> str:
    return str(row.get("mid") or row.get("aweme_id") or row.get("publicUrl") or row.get("index") or "")


async def _fetch_one(sess: crawler.Session, work: dict, comment_limit: int) -> dict:
    mid = str(work.get("mid") or work.get("aweme_id") or "").strip()
    if not mid:
        return {
            "index": work.get("index"),
            "mid": "",
            "publicUrl": work.get("publicUrl") or "",
            "status": "missing_mid",
            "error": "No mid/aweme_id available",
        }

    record = {
        "index": work.get("index"),
        "mid": mid,
        "publicUrl": work.get("publicUrl") or f"https://www.douyin.com/video/{mid}",
        "itemType": work.get("itemType") or "",
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
    }
    try:
        detail = await crawler.fetch_video_detail(sess, mid)
        debug_path = crawler.debug_dir()
        debug_path.mkdir(parents=True, exist_ok=True)
        (debug_path / f"detail_{mid}.json").write_text(json.dumps(detail, ensure_ascii=False, indent=2), encoding="utf-8")

        comment_source = "public"
        comments = await crawler.fetch_comments(sess, mid, max_pages=12)
        record.update(
            {
                "status": "ok",
                "metrics": _extract_metrics(detail),
                "topComments": _normalize_comments(comments, comment_limit),
                "raw": {
                    "detailCapturedCount": len(detail.get("captured") or []),
                    "detailUrls": [item.get("url") for item in (detail.get("captured") or [])[:20]],
                    "commentSource": comment_source,
                },
            }
        )
        if not record["metrics"]:
            record["metricWarning"] = "No known deep metric keys extracted; inspect raw/detail debug URLs."
        if not record["topComments"]:
            record["commentWarning"] = "No comments captured; comments may be closed, hidden, or login may be stale."
    except Exception as exc:  # noqa: BLE001
        record.update({"status": "error", "error": str(exc)})
    return record


async def run(args: argparse.Namespace) -> None:
    works_data = json.loads(Path(args.works).read_text(encoding="utf-8"))
    works = _as_items(works_data)
    out_path = Path(args.out)
    existing_rows = _as_items(json.loads(out_path.read_text(encoding="utf-8"))) if out_path.exists() else []
    existing = {_record_key(row): row for row in existing_rows if _record_key(row)}

    wanted_indexes = {int(item) for item in str(args.indexes or "").split(",") if item.strip().isdigit()}
    targets = []
    for work in works:
        if wanted_indexes and int(work.get("index") or -1) not in wanted_indexes:
            continue
        key = _record_key(work)
        prev = existing.get(key)
        if wanted_indexes or args.force or not prev or not _has_complete_deep(prev):
            targets.append(work)
    if args.limit:
        targets = targets[: args.limit]

    out_path.parent.mkdir(parents=True, exist_ok=True)
    print(json.dumps({"works": len(works), "existing": len(existing), "targets": len(targets)}, ensure_ascii=False))
    if not targets:
        out_path.write_text(json.dumps({"items": existing_rows}, ensure_ascii=False, indent=2), encoding="utf-8")
        return

    sess = await crawler.Session.open(headless=args.headless)
    try:
        for work in targets:
            record = await _fetch_one(sess, work, args.comment_limit)
            existing[_record_key(record)] = record
            merged = sorted(existing.values(), key=lambda row: (row.get("index") is None, row.get("index") or 10**9, row.get("mid") or ""))
            out_path.write_text(json.dumps({"updatedAt": datetime.now(timezone.utc).isoformat(), "items": merged}, ensure_ascii=False, indent=2), encoding="utf-8")
            print(json.dumps({"index": record.get("index"), "mid": record.get("mid"), "status": record.get("status"), "metrics": list((record.get("metrics") or {}).keys()), "comments": len(record.get("topComments") or [])}, ensure_ascii=False))
    finally:
        await sess.close()


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--works", required=True, help="Works JSON with publishedWorks/items list")
    parser.add_argument("--out", required=True, help="Deep metrics progress JSON path")
    parser.add_argument("--limit", type=int, default=0, help="Max items to fetch in this run")
    parser.add_argument("--indexes", default="", help="Comma-separated work indexes to fetch")
    parser.add_argument("--comment-limit", type=int, default=20)
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--headless", action="store_true")
    args = parser.parse_args()
    asyncio.run(run(args))


if __name__ == "__main__":
    main()
