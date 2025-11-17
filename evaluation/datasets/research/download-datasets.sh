#!/bin/bash
# Download Research Datasets
# Generated: 2025-11-17T13:58:22.834Z

set -e

DATASETS_DIR="/Users/arc/Documents/dev/ai-visual-test/evaluation/datasets/research"

echo "📥 Downloading Research Datasets"
echo "=================================="
echo ""

# Create directories
mkdir -p "$DATASETS_DIR/screenai"
mkdir -p "$DATASETS_DIR/multiui"
mkdir -p "$DATASETS_DIR/a11yn"

# ScreenAI - Screen Annotation
echo "📊 Downloading ScreenAI Screen Annotation dataset..."
if [ ! -d "$DATASETS_DIR/screenai/screen_annotation" ]; then
  git clone https://github.com/google-research-datasets/screen_annotation.git "$DATASETS_DIR/screenai/screen_annotation" || echo "⚠️  Git clone failed - check URL"
else
  echo "✅ Screen Annotation already exists"
fi

# ScreenAI - ScreenQA
echo "📊 Downloading ScreenAI ScreenQA dataset..."
if [ ! -d "$DATASETS_DIR/screenai/screen_qa" ]; then
  git clone https://github.com/google-research-datasets/screen_qa.git "$DATASETS_DIR/screenai/screen_qa" || echo "⚠️  Git clone failed - check URL"
else
  echo "✅ ScreenQA already exists"
fi

# MultiUI - Download from HuggingFace
echo "📊 Downloading MultiUI dataset (7.3M samples)..."
if [ ! -d "$DATASETS_DIR/multiui" ]; then
  echo "   HuggingFace dataset: https://huggingface.co/datasets/neulab/MultiUI"
  echo "   Download using: huggingface-cli download neulab/MultiUI --local-dir $DATASETS_DIR/multiui"
  echo "   Or visit: https://huggingface.co/datasets/neulab/MultiUI"
  echo "   ⚠️  Large dataset - consider downloading subset initially"
else
  echo "✅ MultiUI already exists"
fi

# A11YN - Check paper for download link
echo "📊 A11YN dataset - Check paper for download link"
echo "   Paper: https://arxiv.org/abs/2510.13914"
echo "   Look for dataset in paper supplement or GitHub"

echo ""
echo "✅ Download script completed"
echo "📁 Datasets will be in: $DATASETS_DIR"
