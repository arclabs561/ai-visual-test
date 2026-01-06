#!/bin/bash
# Backup dataset files to S3 using s5cmd (optimized for parallel uploads)
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

echo "Starting optimized backup of $SOURCE_DIR to $S3_BUCKET"
echo "Files: $(find "${SOURCE_DIR}" -type f | wc -l | tr -d ' ')"
echo "Size: $(du -sh "${SOURCE_DIR}" 2>/dev/null | awk '{print $1}')"
echo ""

# Optimized approach: Use s5cmd's built-in parallelization
# --numworkers: Number of parallel workers (default: 256, increased for 300k files)
# --concurrency: Concurrent parts per transfer (default: 5, fine for small files)
# Using wildcard pattern for recursive copy (much faster than loop)
echo "Backing up with parallel workers (this will be much faster)..."
echo "Using --numworkers 1000 for optimal throughput with 300k+ files"
echo ""

# s5cmd handles recursive wildcards efficiently with built-in parallelization
# This is 10-100x faster than the sequential loop approach
s5cmd --numworkers 1000 cp "${SOURCE_DIR}/*" "${S3_BUCKET}" 2>&1 | tee /tmp/s3-backup-optimized.log

echo ""
echo "Backup complete. Verify with:"
echo "  s5cmd ls $S3_BUCKET --recursive | wc -l"
echo "  s5cmd du $S3_BUCKET"

