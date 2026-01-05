#!/bin/bash
# Backup dataset files to S3 using s5cmd
# Usage: ./scripts/backup-datasets-to-s3.sh

set -e

SOURCE_DIR="evaluation/datasets/human-annotated"
S3_BUCKET="s3://arclabs-backups/ai-visual-test/datasets/human-annotated/"

if [ ! -d "$SOURCE_DIR" ]; then
  echo "Error: Source directory $SOURCE_DIR does not exist"
  exit 1
fi

if ! command -v s5cmd &> /dev/null; then
  echo "Error: s5cmd not found. Install with: brew install s5cmd"
  exit 1
fi

echo "Starting backup of $SOURCE_DIR to $S3_BUCKET"
echo "Storage class: STANDARD_IA (Infrequent Access)"
echo ""

s5cmd cp "$SOURCE_DIR/" "$S3_BUCKET" \
  --recursive \
  --storage-class STANDARD_IA \
  --concurrency 50

echo ""
echo "Backup complete. Verify with:"
echo "  s5cmd ls $S3_BUCKET --recursive | wc -l"
echo "  s5cmd du $S3_BUCKET"

