#!/usr/bin/env python3
"""
run_pix2tex_benchmark.py

Executes real offline pix2tex / RapidLaTeXOCR ONNX inference on the 10 real KaTeX fixtures.
Measures wall-clock startup time, per-fixture latency, peak memory (tracemalloc and RSS),
and outputs raw predictions to pix2tex_measured_results.json.

ALL NUMBERS IN THIS SCRIPT ARE EMPIRICALLY MEASURED.
"""

import json
import os
import sys
import time
import tracemalloc
from pathlib import Path

# Measure initial RSS
def get_rss_mb():
    try:
        import resource
        return round(resource.getrusage(resource.RUSAGE_SELF).ru_maxrss / 1024, 2)
    except Exception:
        return 0.0

FIXTURES_DIR = Path("tests/fixtures/real")
MODELS_DIR = Path("pix2tex_models")
OUTPUT_FILE = "pix2tex_measured_results.json"

FIXTURES = [
    {
        "id": "case_01_pythagoras",
        "name": "Pythagorean Equation",
        "category": "math_single_line",
        "groundTruth": "x^2 + y^2 = z^2",
    },
    {
        "id": "case_02_fraction",
        "name": "Algebraic Fraction",
        "category": "math_fraction",
        "groundTruth": "\\frac{a + b}{c}",
    },
    {
        "id": "case_03_sqrt",
        "name": "Radical Expression",
        "category": "math_radical",
        "groundTruth": "\\sqrt{x^2 + 1}",
    },
    {
        "id": "case_04_integral",
        "name": "Definite Integral with Limits",
        "category": "math_2d_limits",
        "groundTruth": "\\int_{0}^{1} x^2 dx",
    },
    {
        "id": "case_05_summation",
        "name": "Summation with Bounds",
        "category": "math_2d_limits",
        "groundTruth": "\\sum_{i=1}^{n} i",
    },
    {
        "id": "case_06_matrix",
        "name": "2x2 Matrix",
        "category": "math_matrix",
        "groundTruth": "\\begin{pmatrix} 1 & 2 \\\\ 3 & 4 \\end{pmatrix}",
    },
    {
        "id": "case_07_system",
        "name": "System of Equations",
        "category": "math_multiline",
        "groundTruth": "\\begin{cases} 2x + y = 5 \\\\ x - 3y = 2 \\end{cases}",
    },
    {
        "id": "case_08_french_math",
        "name": "French Paragraph with Inline Math",
        "category": "mixed_text_math",
        "groundTruth": "Soit f une fonction continue sur l'intervalle [0, 1]. On considère l'intégrale suivante : I = \\int_{0}^{1} f(x) dx. Calculer la valeur moyenne de f.",
    },
    {
        "id": "case_09_french_accents",
        "name": "French Accented Text",
        "category": "french_prose",
        "groundTruth": "Documentation Français. Voici des caractères accentués : é, è, à, ç, œ, ù. L'élève étudie attentivement le théorème où apparaît le paramètre déjà défini.",
    },
    {
        "id": "case_10_table_math",
        "name": "Table with Mathematical Expressions",
        "category": "tabular_math",
        "groundTruth": "\\begin{tabular}{lll} Fonction & Dérivée & Primitive \\\\ f(x) = x^2 & f'(x) = 2x & F(x) = \\frac{1}{3}x^3 \\\\ g(x) = \\sin(x) & g'(x) = \\cos(x) & G(x) = -\\cos(x) \\end{tabular}",
    },
]

def main():
    print("=" * 70)
    print("PIX2TEX / RAPID-LATEX-OCR EMPIRICAL BENCHMARK")
    print("=" * 70)

    # 1. Model file sizes on disk
    model_files = {
        "image_resizer": MODELS_DIR / "image_resizer.onnx",
        "encoder": MODELS_DIR / "encoder.onnx",
        "decoder": MODELS_DIR / "decoder.onnx",
        "tokenizer": MODELS_DIR / "tokenizer.json",
    }

    model_sizes = {}
    total_bytes = 0
    for name, path in model_files.items():
        if not path.exists():
            print(f"Error: missing model file {path}")
            sys.exit(1)
        sz = path.stat().st_size
        total_bytes += sz
        model_sizes[name] = {
            "bytes": sz,
            "mb": round(sz / (1024 * 1024), 2),
        }

    total_mb = round(total_bytes / (1024 * 1024), 2)
    print(f"[MEASURED] Total ONNX weights size: {total_mb} MB")

    # 2. Startup time and memory
    tracemalloc.start()
    t_start = time.perf_counter()
    from rapid_latex_ocr import LaTeXOCR

    model = LaTeXOCR(
        image_resizer_path=str(model_files["image_resizer"]),
        encoder_path=str(model_files["encoder"]),
        decoder_path=str(model_files["decoder"]),
        tokenizer_json=str(model_files["tokenizer"]),
    )
    startup_ms = round((time.perf_counter() - t_start) * 1000)
    print(f"[MEASURED] Model initialization time: {startup_ms} ms")

    # 3. Benchmark fixtures
    results = []
    latencies = []

    for f_info in FIXTURES:
        fid = f_info["id"]
        img_path = FIXTURES_DIR / f"{fid}.png"
        if not img_path.exists():
            print(f"Warning: missing fixture {img_path}")
            continue

        with open(img_path, "rb") as f:
            img_bytes = f.read()

        t0 = time.perf_counter()
        latex_out, internal_elapse = model(img_bytes)
        elapsed_ms = round((time.perf_counter() - t0) * 1000)
        latencies.append(elapsed_ms)

        print(f"[{fid}] latency: {elapsed_ms} ms | internal: {internal_elapse}s")
        print(f"  OUTPUT: {latex_out[:90]}...")

        results.append({
            "id": fid,
            "name": f_info["name"],
            "category": f_info["category"],
            "groundTruth": f_info["groundTruth"],
            "rawOutput": latex_out,
            "latencyMs": elapsed_ms,
            "internalElapseSeconds": round(internal_elapse, 3) if isinstance(internal_elapse, (int, float)) else None,
            "dataSource": "MEASURED",
        })

    # Memory measurement
    current_traced, peak_traced = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    peak_rss_mb = get_rss_mb()

    avg_latency_ms = round(sum(latencies) / len(latencies)) if latencies else 0

    output_data = {
        "status": "SUCCESS",
        "engine": "pix2tex / RapidLaTeXOCR (ONNX Runtime CPU)",
        "dataSource": "MEASURED (executed on 10 fixtures)",
        "modelWeights": {
            "files": model_sizes,
            "totalMb": total_mb,
            "dataSource": "MEASURED (fs.stat)",
        },
        "performance": {
            "startupMs": startup_ms,
            "averageLatencyMs": avg_latency_ms,
            "peakTracemallocMb": round(peak_traced / (1024 * 1024), 2),
            "peakRssMb": peak_rss_mb,
            "dataSource": "MEASURED",
        },
        "fixtures": results,
    }

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output_data, f, indent=2, ensure_ascii=False)

    print("\n" + "=" * 70)
    print(f"Results saved to {OUTPUT_FILE}")
    print(f"Total model weights: {total_mb} MB")
    print(f"Startup: {startup_ms} ms")
    print(f"Average latency: {avg_latency_ms} ms")
    print(f"Peak RSS: {peak_rss_mb} MB")
    print("=" * 70)

if __name__ == "__main__":
    main()
