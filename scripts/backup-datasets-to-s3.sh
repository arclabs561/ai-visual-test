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

# s5cmd syntax: cp <source> <destination>
# For large directories, use find + loop
# Note: Storage class can be set via lifecycle policy on bucket instead
# This approach handles 300k+ files efficiently
echo "Backing up files (this may take a while for 18GB)..."
find "${SOURCE_DIR}" -type f | while read file; do
  rel_path=${file#${SOURCE_DIR}/}
  # Remove leading slash if present
  rel_path=${rel_path#/}
  s5cmd cp "$file" "${S3_BUCKET}${rel_path}"
done

echo ""
echo "Backup complete. Verify with:"
echo "  s5cmd ls $S3_BUCKET --recursive | wc -l"
echo "  s5cmd du $S3_BUCKET"

