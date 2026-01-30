from __future__ import annotations

import argparse
import json
from pathlib import Path


def _iter_jsonl(path: Path):
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError:
                continue


def _conversation_to_text(conv) -> str:
    if isinstance(conv, list):
        parts = []
        for msg in conv:
            if not isinstance(msg, dict):
                continue
            role = str(msg.get("role", "")).strip()
            content = str(msg.get("content", "")).strip()
            if role and content:
                parts.append(f"{role}: {content}")
            elif content:
                parts.append(content)
        return "\n".join(parts)
    return json.dumps(conv, ensure_ascii=True)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build a compact labeling dataset for the GitHub Pages annotator."
    )
    parser.add_argument(
        "--reco-dir",
        default="dataset/reco_by_category",
        help="Directory with top20_<Category>.jsonl outputs.",
    )
    parser.add_argument(
        "--chat-dir",
        default="dataset/chat/by_category",
        help="Directory with per-category conversations.",
    )
    parser.add_argument(
        "--out",
        default="docs/data.json",
        help="Output JSON for the annotator site.",
    )
    parser.add_argument(
        "--max-items",
        type=int,
        default=None,
        help="Optional max records to include (for quick demo).",
    )
    parser.add_argument(
        "--split-threshold",
        type=int,
        default=200,
        help="If a category has more than this many records, split into chunks of this size.",
    )
    args = parser.parse_args()

    reco_dir = Path(args.reco_dir)
    chat_dir = Path(args.chat_dir)
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    # First pass: count records per category to determine splitting.
    category_counts: dict[str, int] = {}
    for reco_path in sorted(reco_dir.glob("top20_*.jsonl")):
        category = reco_path.stem.replace("top20_", "")
        count = 0
        for _ in _iter_jsonl(reco_path):
            count += 1
        category_counts[category] = count

    records = []
    total = 0
    for reco_path in sorted(reco_dir.glob("top20_*.jsonl")):
        category = reco_path.stem.replace("top20_", "")
        chat_path = chat_dir / f"{category}.jsonl"
        if not chat_path.exists():
            continue

        total_in_category = category_counts.get(category, 0)
        split = total_in_category > args.split_threshold
        chunk_size = args.split_threshold if split else 0

        chat_rows = list(_iter_jsonl(chat_path))
        for idx, reco_row in enumerate(_iter_jsonl(reco_path), start=1):
            if idx > len(chat_rows):
                break
            convo = chat_rows[idx - 1].get("conversation", chat_rows[idx - 1])
            items = reco_row.get("llm_top20_items") or []
            cleaned_items = []
            for it in items:
                if not isinstance(it, dict):
                    continue
                cleaned_items.append(
                    {"id": it.get("id", ""), "title": it.get("title", "")}
                )
            if split and chunk_size > 0:
                part = (idx - 1) // chunk_size + 1
                category_label = f"{category}_{part}"
            else:
                category_label = category

            record = {
                "id": f"{category}:{idx}",
                "category": category_label,
                "base_category": category,
                "conversation_index": idx,
                "conversation": convo,
                "conversation_text": _conversation_to_text(convo),
                "items": cleaned_items,
            }
            records.append(record)
            total += 1
            if args.max_items is not None and total >= args.max_items:
                break
        if args.max_items is not None and total >= args.max_items:
            break

    with out_path.open("w", encoding="utf-8") as f:
        json.dump(records, f, ensure_ascii=False)

    print(f"wrote {len(records)} records to {out_path}")


if __name__ == "__main__":
    main()
