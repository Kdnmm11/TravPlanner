#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
import os
import shutil
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import fitz
import requests


DEFAULT_MODEL = "gpt-4.1-mini"
DEFAULT_FONT = "/Users/hyun/Library/Fonts/NanumSquareR.otf"
API_URL = "https://api.openai.com/v1/responses"


@dataclass
class TextBlock:
    bbox: tuple[float, float, float, float]
    text: str
    font_size: float


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Translate a PDF into Korean while preserving the original layout as much as possible."
    )
    parser.add_argument("input_pdf", help="Path to the source PDF")
    parser.add_argument(
        "--output-pdf",
        help="Path to the translated output PDF. Defaults to '<input>_ko_overlay.pdf'",
    )
    parser.add_argument(
        "--cache-jsonl",
        help="Path to the page translation cache file. Defaults next to the output PDF.",
    )
    parser.add_argument("--start-page", type=int, default=1, help="1-based inclusive start page")
    parser.add_argument("--end-page", type=int, help="1-based inclusive end page")
    parser.add_argument("--max-pages", type=int, help="Maximum number of pages to process in this run")
    parser.add_argument("--model", default=DEFAULT_MODEL, help=f"OpenAI model name. Default: {DEFAULT_MODEL}")
    parser.add_argument("--font-file", default=DEFAULT_FONT, help=f"Korean font file path. Default: {DEFAULT_FONT}")
    parser.add_argument("--font-name", default="nanum-overlay", help="Internal PDF font name")
    parser.add_argument("--margin", type=float, default=2.5, help="Overlay inset in PDF points")
    parser.add_argument("--fill-opacity", type=float, default=0.96, help="Background white box opacity")
    parser.add_argument("--line-height", type=float, default=0.98, help="Textbox line height multiplier")
    parser.add_argument("--min-font-size", type=float, default=5.0, help="Minimum fitted font size")
    parser.add_argument("--save-every", type=int, default=5, help="Incremental save frequency in pages")
    parser.add_argument("--overwrite", action="store_true", help="Replace an existing output PDF and cache")
    parser.add_argument("--dry-run", action="store_true", help="Only inspect pages and write no output")
    parser.add_argument("--skip-existing", action="store_true", default=True, help="Skip pages already cached")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    input_pdf = Path(args.input_pdf).expanduser().resolve()
    if not input_pdf.exists():
        print(f"Input PDF not found: {input_pdf}", file=sys.stderr)
        return 1

    output_pdf = (
        Path(args.output_pdf).expanduser().resolve()
        if args.output_pdf
        else input_pdf.with_name(f"{input_pdf.stem}_ko_overlay.pdf")
    )
    cache_jsonl = (
        Path(args.cache_jsonl).expanduser().resolve()
        if args.cache_jsonl
        else output_pdf.with_suffix(".translations.jsonl")
    )

    if args.dry_run:
        inspect_pdf(input_pdf, args.start_page, args.end_page, args.max_pages)
        return 0

    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        print("OPENAI_API_KEY is not set.", file=sys.stderr)
        return 2

    font_path = Path(args.font_file).expanduser().resolve()
    if not font_path.exists():
        print(f"Font file not found: {font_path}", file=sys.stderr)
        return 3

    if args.overwrite and output_pdf.exists():
        output_pdf.unlink()
    if args.overwrite and cache_jsonl.exists():
        cache_jsonl.unlink()

    if not output_pdf.exists():
        shutil.copy2(input_pdf, output_pdf)

    cache = load_cache(cache_jsonl)
    session = requests.Session()
    session.headers.update(
        {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }
    )

    doc = fitz.open(output_pdf)
    try:
        start_index = max(0, args.start_page - 1)
        end_index = doc.page_count - 1 if args.end_page is None else min(doc.page_count - 1, args.end_page - 1)
        page_indexes = list(range(start_index, end_index + 1))
        if args.max_pages is not None:
            page_indexes = page_indexes[: args.max_pages]

        processed = 0
        for page_index in page_indexes:
            page_number = page_index + 1
            page = doc.load_page(page_index)
            blocks = extract_text_blocks(page)
            if not blocks:
                print(f"[page {page_number}] no text blocks, skipped")
                continue

            if args.skip_existing and str(page_index) in cache:
                print(f"[page {page_number}] cached, skipped")
                continue

            print(f"[page {page_number}] translating {len(blocks)} blocks")
            translations = translate_page(
                session=session,
                model=args.model,
                page_number=page_number,
                blocks=blocks,
            )
            if len(translations) != len(blocks):
                raise RuntimeError(
                    f"Page {page_number}: translation count mismatch ({len(translations)} != {len(blocks)})"
                )

            apply_translations(
                page=page,
                blocks=blocks,
                translations=translations,
                font_name=args.font_name,
                font_file=str(font_path),
                margin=args.margin,
                fill_opacity=args.fill_opacity,
                line_height=args.line_height,
                min_font_size=args.min_font_size,
            )
            cache[str(page_index)] = {
                "page_number": page_number,
                "translations": translations,
            }
            append_cache_record(cache_jsonl, page_index, page_number, translations)
            processed += 1

            if processed % max(1, args.save_every) == 0:
                doc.saveIncr()
                print(f"[save] incremental save after {processed} translated pages")

        doc.saveIncr()
    finally:
        doc.close()

    print(f"Output PDF: {output_pdf}")
    print(f"Cache file: {cache_jsonl}")
    return 0


def inspect_pdf(input_pdf: Path, start_page: int, end_page: int | None, max_pages: int | None) -> None:
    doc = fitz.open(input_pdf)
    try:
        start_index = max(0, start_page - 1)
        end_index = doc.page_count - 1 if end_page is None else min(doc.page_count - 1, end_page - 1)
        page_indexes = list(range(start_index, end_index + 1))
        if max_pages is not None:
            page_indexes = page_indexes[:max_pages]
        print(f"pages={doc.page_count}")
        for page_index in page_indexes:
            page = doc.load_page(page_index)
            blocks = extract_text_blocks(page)
            chars = sum(len(block.text) for block in blocks)
            print(f"page={page_index + 1} blocks={len(blocks)} chars={chars}")
            for block in blocks[:3]:
                sample = " ".join(block.text.split())[:180]
                print(f"  bbox={tuple(round(v, 1) for v in block.bbox)} size={block.font_size:.1f} text={sample}")
    finally:
        doc.close()


def load_cache(cache_jsonl: Path) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    if not cache_jsonl.exists():
        return result
    with cache_jsonl.open("r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            record = json.loads(line)
            result[str(record["page_index"])] = record
    return result


def append_cache_record(
    cache_jsonl: Path,
    page_index: int,
    page_number: int,
    translations: list[str],
) -> None:
    cache_jsonl.parent.mkdir(parents=True, exist_ok=True)
    with cache_jsonl.open("a", encoding="utf-8") as handle:
        handle.write(
            json.dumps(
                {
                    "page_index": page_index,
                    "page_number": page_number,
                    "translations": translations,
                },
                ensure_ascii=False,
            )
            + "\n"
        )


def extract_text_blocks(page: fitz.Page) -> list[TextBlock]:
    text_dict = page.get_text("dict")
    blocks: list[TextBlock] = []
    for block in text_dict.get("blocks", []):
        if block.get("type") != 0:
            continue
        lines = block.get("lines") or []
        text_lines: list[str] = []
        font_sizes: list[float] = []
        for line in lines:
            spans = line.get("spans") or []
            line_text = "".join(span.get("text", "") for span in spans)
            if not line_text.strip():
                continue
            text_lines.append(line_text.rstrip())
            for span in spans:
                size = span.get("size")
                if isinstance(size, (int, float)) and size > 0:
                    font_sizes.append(float(size))
        text = "\n".join(text_lines).strip()
        if not text:
            continue
        bbox = tuple(float(v) for v in block.get("bbox", (0, 0, 0, 0)))
        font_size = median(font_sizes) if font_sizes else estimate_font_size_from_bbox(bbox, len(text_lines))
        blocks.append(TextBlock(bbox=bbox, text=text, font_size=font_size))
    return blocks


def median(values: list[float]) -> float:
    ordered = sorted(values)
    mid = len(ordered) // 2
    if not ordered:
        return 10.0
    if len(ordered) % 2 == 1:
        return ordered[mid]
    return (ordered[mid - 1] + ordered[mid]) / 2


def estimate_font_size_from_bbox(bbox: tuple[float, float, float, float], line_count: int) -> float:
    x0, y0, x1, y1 = bbox
    height = max(8.0, y1 - y0)
    lines = max(1, line_count)
    return max(8.0, min(16.0, height / (lines * 1.4)))


def translate_page(
    session: requests.Session,
    model: str,
    page_number: int,
    blocks: list[TextBlock],
) -> list[str]:
    payload = {
        "model": model,
        "input": [
            {
                "role": "system",
                "content": [
                    {
                        "type": "input_text",
                        "text": (
                            "Translate PDF text blocks from English to Korean.\n"
                            "Return one Korean translation per input block in the same order.\n"
                            "Preserve numbering, citations, section structure, and line-break-sensitive labels.\n"
                            "Keep drug names, laser names, gene names, units, and medical abbreviations in English when standard.\n"
                            "Do not add explanations, summaries, or notes."
                        ),
                    }
                ],
            },
            {
                "role": "user",
                "content": [
                    {
                        "type": "input_text",
                        "text": json.dumps(
                            {
                                "page_number": page_number,
                                "blocks": [block.text for block in blocks],
                            },
                            ensure_ascii=False,
                        ),
                    }
                ],
            },
        ],
        "text": {
            "format": {
                "type": "json_schema",
                "name": "page_translation",
                "strict": True,
                "schema": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "translations": {
                            "type": "array",
                            "items": {"type": "string"},
                        }
                    },
                    "required": ["translations"],
                },
            }
        },
    }

    for attempt in range(1, 6):
        response = session.post(API_URL, json=payload, timeout=180)
        if response.status_code in {429, 500, 502, 503, 504}:
            wait_seconds = min(30, 2 ** attempt)
            print(f"  retryable error {response.status_code}, waiting {wait_seconds}s", file=sys.stderr)
            time.sleep(wait_seconds)
            continue
        response.raise_for_status()
        data = response.json()
        text = extract_response_text(data)
        parsed = json.loads(text)
        translations = parsed.get("translations")
        if not isinstance(translations, list) or not all(isinstance(item, str) for item in translations):
            raise RuntimeError(f"Invalid translation payload on page {page_number}")
        return translations
    raise RuntimeError(f"OpenAI request failed repeatedly for page {page_number}")


def extract_response_text(data: dict[str, Any]) -> str:
    output_text = data.get("output_text")
    if isinstance(output_text, str) and output_text.strip():
        return output_text

    for item in data.get("output", []):
        if not isinstance(item, dict):
            continue
        for content in item.get("content", []):
            if not isinstance(content, dict):
                continue
            text = content.get("text")
            if isinstance(text, str) and text.strip():
                return text
    raise RuntimeError(f"Could not find text in OpenAI response: {json.dumps(data)[:800]}")


def apply_translations(
    page: fitz.Page,
    blocks: list[TextBlock],
    translations: list[str],
    font_name: str,
    font_file: str,
    margin: float,
    fill_opacity: float,
    line_height: float,
    min_font_size: float,
) -> None:
    page.insert_font(fontname=font_name, fontfile=font_file)
    for block, translated in zip(blocks, translations):
        translated = translated.strip()
        if not translated:
            continue
        rect = fitz.Rect(block.bbox).irect
        rect = fitz.Rect(
            rect.x0 + margin,
            rect.y0 + margin,
            rect.x1 - margin,
            rect.y1 - margin,
        )
        if rect.width < 8 or rect.height < 8:
            continue

        bg_rect = fitz.Rect(block.bbox)
        shape = page.new_shape()
        shape.draw_rect(bg_rect)
        shape.finish(fill=(1, 1, 1), color=None, fill_opacity=fill_opacity)
        shape.commit()

        font_size = fit_font_size(
            page=page,
            rect=rect,
            text=translated,
            font_name=font_name,
            preferred=block.font_size,
            min_size=min_font_size,
            line_height=line_height,
        )
        page.insert_textbox(
            rect,
            translated,
            fontname=font_name,
            fontsize=font_size,
            color=(0, 0, 0),
            align=fitz.TEXT_ALIGN_LEFT,
            lineheight=line_height,
        )


def fit_font_size(
    page: fitz.Page,
    rect: fitz.Rect,
    text: str,
    font_name: str,
    preferred: float,
    min_size: float,
    line_height: float,
) -> float:
    low = min_size
    high = max(min_size, min(preferred, rect.height))
    best = min_size

    for _ in range(12):
        mid = (low + high) / 2
        temp_shape = page.new_shape()
        spare = temp_shape.insert_textbox(
            rect,
            text,
            fontname=font_name,
            fontsize=mid,
            lineheight=line_height,
        )
        if spare >= 0:
            best = mid
            low = mid
        else:
            high = mid
    return round(best, 2)


if __name__ == "__main__":
    raise SystemExit(main())
