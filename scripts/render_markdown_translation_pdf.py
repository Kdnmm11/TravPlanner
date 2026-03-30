#!/usr/bin/env python3
from __future__ import annotations

import argparse
import re
import sys
from dataclasses import dataclass
from pathlib import Path

import fitz


DEFAULT_FONT = "/Users/hyun/Library/Fonts/NanumSquareR.otf"
PAGE_HEADING_RE = re.compile(r"^## 페이지 (\d+)\s*$")


@dataclass
class FlowLine:
    rect: fitz.Rect
    align: int


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Render translated markdown back onto PDF pages while preserving embedded images."
    )
    parser.add_argument("input_pdf", help="Path to the original PDF")
    parser.add_argument("translation_md", help="Markdown file containing translated pages")
    parser.add_argument("--output-pdf", required=True, help="Output PDF path")
    parser.add_argument("--font-file", default=DEFAULT_FONT, help=f"Korean font file path. Default: {DEFAULT_FONT}")
    parser.add_argument("--font-name", default="nanum-overlay", help="Internal PDF font name")
    parser.add_argument("--fill-opacity", type=float, default=0.985, help="Opacity for white translation panels")
    parser.add_argument("--content-padding", type=float, default=12.0, help="Padding around detected text content")
    parser.add_argument("--image-gap", type=float, default=10.0, help="Spacing kept around embedded images")
    parser.add_argument("--line-height", type=float, default=1.22, help="Line height multiplier")
    parser.add_argument("--line-padding-x", type=float, default=5.0, help="Horizontal padding inside flow regions")
    parser.add_argument("--line-padding-y", type=float, default=3.0, help="Vertical padding inside flow regions")
    parser.add_argument("--max-font-size", type=float, default=14.0, help="Maximum font size")
    parser.add_argument("--min-font-size", type=float, default=6.0, help="Minimum font size")
    parser.add_argument("--overwrite", action="store_true", help="Replace an existing output file")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    input_pdf = Path(args.input_pdf).expanduser().resolve()
    translation_md = Path(args.translation_md).expanduser().resolve()
    output_pdf = Path(args.output_pdf).expanduser().resolve()
    font_path = Path(args.font_file).expanduser().resolve()

    if not input_pdf.exists():
        print(f"Input PDF not found: {input_pdf}", file=sys.stderr)
        return 1
    if not translation_md.exists():
        print(f"Translation markdown not found: {translation_md}", file=sys.stderr)
        return 2
    if not font_path.exists():
        print(f"Font file not found: {font_path}", file=sys.stderr)
        return 3
    if output_pdf.exists():
        if not args.overwrite:
            print(f"Output already exists: {output_pdf}", file=sys.stderr)
            return 4
        output_pdf.unlink()

    translations = load_translations(translation_md)
    if not translations:
        print("No translated pages found in the markdown file.", file=sys.stderr)
        return 5

    first_page = min(translations)
    last_page = max(translations)
    with fitz.open(input_pdf) as source:
        if first_page < 1 or last_page > source.page_count:
            print(
                f"Translated page range {first_page}-{last_page} exceeds source PDF page count {source.page_count}.",
                file=sys.stderr,
            )
            return 6
        doc = fitz.open()
        doc.insert_pdf(source, from_page=first_page - 1, to_page=last_page - 1)

    font = fitz.Font(fontfile=str(font_path))
    try:
        for page_number, text in sorted(translations.items()):
            if not text or text == "[빈 페이지]":
                print(f"[page {page_number}] blank page, left unchanged")
                continue

            page = doc.load_page(page_number - first_page)
            content_rect = detect_content_rect(page, args.content_padding)
            if content_rect is None:
                print(f"[page {page_number}] no text content, left unchanged")
                continue
            image_rects = detect_image_rects(page, args.image_gap)
            flow_regions = build_flow_regions(content_rect, image_rects)
            if not flow_regions:
                flow_regions = [content_rect]

            layout = layout_page_text(
                text=text,
                regions=flow_regions,
                font=font,
                line_height=args.line_height,
                max_font_size=args.max_font_size,
                min_font_size=args.min_font_size,
                line_padding_x=args.line_padding_x,
                line_padding_y=args.line_padding_y,
            )
            if layout is None:
                print(f"[page {page_number}] layout failed")
                continue

            page.insert_font(fontname=args.font_name, fontfile=str(font_path))
            for region in flow_regions:
                draw_overlay(page, region, args.fill_opacity)
            for line in layout["lines"]:
                insert_line_text(
                    page=page,
                    rect=line["rect"],
                    text=line["text"],
                    font=font,
                    font_name=args.font_name,
                    font_size=layout["font_size"],
                    align=layout["align"],
                )
            print(
                f"[page {page_number}] rendered {len(layout['lines'])} lines across {len(flow_regions)} region(s) at {layout['font_size']:.2f}pt"
            )

        doc.save(output_pdf, garbage=3, deflate=True)
    finally:
        doc.close()

    print(f"Output PDF: {output_pdf}")
    return 0


def load_translations(path: Path) -> dict[int, str]:
    pages: dict[int, str] = {}
    current_page: int | None = None
    current_lines: list[str] = []

    def flush() -> None:
        nonlocal current_page, current_lines
        if current_page is None:
            return
        text = normalize_translation_text("\n".join(current_lines))
        pages[current_page] = text
        current_lines = []

    for raw_line in path.read_text(encoding="utf-8").splitlines():
        line = raw_line.rstrip()
        match = PAGE_HEADING_RE.match(line.strip())
        if match:
            flush()
            current_page = int(match.group(1))
            continue
        if current_page is None:
            continue
        if line.strip() == "---":
            continue
        current_lines.append(line)

    flush()
    return pages


def normalize_translation_text(text: str) -> str:
    text = text.replace("**", "")
    text = text.replace("`", "")
    text = text.replace("\u00a0", " ")
    paragraphs = []
    current: list[str] = []
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            if current:
                paragraphs.append(" ".join(current))
                current = []
            continue
        current.append(line)
    if current:
        paragraphs.append(" ".join(current))
    normalized = "\n\n".join(part.strip() for part in paragraphs if part.strip()).strip()
    return normalized or "[빈 페이지]"


def detect_content_rect(page: fitz.Page, padding: float) -> fitz.Rect | None:
    text_rects: list[fitz.Rect] = []
    for block in page.get_text("dict").get("blocks", []):
        if block.get("type") != 0:
            continue
        text = "".join("".join(span.get("text", "") for span in line.get("spans", [])) for line in block.get("lines", []))
        if text.strip():
            text_rects.append(fitz.Rect(block["bbox"]))
    if not text_rects:
        return None

    union = text_rects[0]
    for rect in text_rects[1:]:
        union |= rect
    page_rect = page.rect
    return fitz.Rect(
        max(page_rect.x0 + 24, union.x0 - padding),
        max(page_rect.y0 + 24, union.y0 - padding),
        min(page_rect.x1 - 24, union.x1 + padding),
        min(page_rect.y1 - 24, union.y1 + padding),
    )


def detect_image_rects(page: fitz.Page, gap: float) -> list[fitz.Rect]:
    rects: list[fitz.Rect] = []
    for block in page.get_text("dict").get("blocks", []):
        if block.get("type") != 1:
            continue
        rect = fitz.Rect(block["bbox"])
        rects.append(fitz.Rect(rect.x0 - gap, rect.y0 - gap, rect.x1 + gap, rect.y1 + gap))
    return rects


def build_flow_regions(content_rect: fitz.Rect, image_rects: list[fitz.Rect]) -> list[fitz.Rect]:
    regions = [content_rect]
    for image_rect in image_rects:
        next_regions: list[fitz.Rect] = []
        for region in regions:
            if not region.intersects(image_rect):
                next_regions.append(region)
                continue
            overlap = region & image_rect
            candidates = [
                fitz.Rect(region.x0, region.y0, region.x1, overlap.y0),
                fitz.Rect(region.x0, overlap.y0, overlap.x0, overlap.y1),
                fitz.Rect(overlap.x1, overlap.y0, region.x1, overlap.y1),
                fitz.Rect(region.x0, overlap.y1, region.x1, region.y1),
            ]
            next_regions.extend(rect for rect in candidates if rect.width >= 70 and rect.height >= 24)
        regions = next_regions or regions
    regions.sort(key=lambda rect: (round(rect.y0, 2), round(rect.x0, 2)))
    return regions


def layout_page_text(
    text: str,
    regions: list[fitz.Rect],
    font: fitz.Font,
    line_height: float,
    max_font_size: float,
    min_font_size: float,
    line_padding_x: float,
    line_padding_y: float,
) -> dict[str, object] | None:
    paragraphs = [part.strip() for part in text.split("\n\n") if part.strip()]
    if not paragraphs:
        return None
    align = choose_alignment(paragraphs)

    low = min_font_size
    high = max_font_size
    best: dict[str, object] | None = None
    for _ in range(12):
        font_size = (low + high) / 2
        lines = build_flow_lines(regions, font_size, line_height, line_padding_x, line_padding_y, align)
        laid_out = flow_text_into_lines(paragraphs, lines, font, font_size)
        if laid_out is None:
            high = font_size
            continue
        best = {"font_size": round(font_size, 2), "align": align, "lines": laid_out}
        low = font_size

    if best is None:
        lines = build_flow_lines(regions, min_font_size, line_height, line_padding_x, line_padding_y, align)
        laid_out = flow_text_into_lines(paragraphs, lines, font, min_font_size, allow_truncation=True)
        if laid_out is None:
            return None
        best = {"font_size": round(min_font_size, 2), "align": align, "lines": laid_out}
    return best


def choose_alignment(paragraphs: list[str]) -> int:
    total_length = sum(len(part) for part in paragraphs)
    if len(paragraphs) <= 3 and total_length <= 220:
        return fitz.TEXT_ALIGN_CENTER
    return fitz.TEXT_ALIGN_LEFT


def build_flow_lines(
    regions: list[fitz.Rect],
    font_size: float,
    line_height: float,
    line_padding_x: float,
    line_padding_y: float,
    align: int,
) -> list[FlowLine]:
    lines: list[FlowLine] = []
    step = font_size * line_height
    for region in regions:
        usable = fitz.Rect(
            region.x0 + line_padding_x,
            region.y0 + line_padding_y,
            region.x1 - line_padding_x,
            region.y1 - line_padding_y,
        )
        if usable.width < 20 or usable.height < font_size:
            continue
        line_count = max(1, int(usable.height // step))
        for index in range(line_count):
            y0 = usable.y0 + index * step
            y1 = min(usable.y1, y0 + step)
            lines.append(FlowLine(rect=fitz.Rect(usable.x0, y0, usable.x1, y1), align=align))
    return lines


def flow_text_into_lines(
    paragraphs: list[str],
    lines: list[FlowLine],
    font: fitz.Font,
    font_size: float,
    allow_truncation: bool = False,
) -> list[dict[str, object]] | None:
    remaining = list(paragraphs)
    rendered: list[dict[str, object]] = []
    for line in lines:
        if not remaining:
            break
        current = remaining[0]
        line_text = fit_line_text(current, line.rect.width, font, font_size)
        if not line_text:
            return None
        rendered.append({"rect": line.rect, "text": line_text})
        leftover = current[len(line_text) :].lstrip()
        if leftover:
            remaining[0] = leftover
        else:
            remaining.pop(0)

    if remaining and not allow_truncation:
        return None
    return rendered


def fit_line_text(text: str, width: float, font: fitz.Font, font_size: float) -> str:
    if font.text_length(text, font_size) <= width:
        return text

    low = 1
    high = len(text)
    best = 1
    while low <= high:
        middle = (low + high) // 2
        candidate = text[:middle]
        if font.text_length(candidate, font_size) <= width:
            best = middle
            low = middle + 1
        else:
            high = middle - 1

    candidate = text[:best]
    minimum_break = max(1, int(best * 0.55))
    break_positions = [
        candidate.rfind(" "),
        candidate.rfind("/"),
        candidate.rfind(","),
        candidate.rfind(";"),
        candidate.rfind(":"),
        candidate.rfind(")"),
        candidate.rfind("]"),
    ]
    cut = max(position for position in break_positions if position >= minimum_break) if any(position >= minimum_break for position in break_positions) else -1
    if cut != -1:
        candidate = candidate[:cut]
    return candidate.rstrip() or text[:1]


def draw_overlay(page: fitz.Page, rect: fitz.Rect, fill_opacity: float) -> None:
    shape = page.new_shape()
    shape.draw_rect(rect)
    shape.finish(fill=(1, 1, 1), color=None, fill_opacity=fill_opacity)
    shape.commit()


def insert_line_text(
    page: fitz.Page,
    rect: fitz.Rect,
    text: str,
    font: fitz.Font,
    font_name: str,
    font_size: float,
    align: int,
) -> None:
    text_width = font.text_length(text, font_size)
    if align == fitz.TEXT_ALIGN_CENTER:
        x = rect.x0 + max(0.0, (rect.width - text_width) / 2)
    elif align == fitz.TEXT_ALIGN_RIGHT:
        x = max(rect.x0, rect.x1 - text_width)
    else:
        x = rect.x0
    y = rect.y0 + font_size
    page.insert_text(
        fitz.Point(x, y),
        text,
        fontname=font_name,
        fontsize=font_size,
        color=(0, 0, 0),
    )


if __name__ == "__main__":
    raise SystemExit(main())
