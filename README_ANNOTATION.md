# Human Annotation - Quick Start Guide

## 🚀 Start Annotating (For Humans)

You haven't been invoked yet as a human annotator. Here's the simplest way to start:

### Quick Start

```bash
npm run annotate
```

Or directly:

```bash
node evaluation/utils/quick-start-annotation.mjs
```

**That's it!** Just follow the prompts.

---

## 📋 What You'll Do

1. **Enter your name/ID** (e.g., "alice" or "reviewer-1")
2. **Choose how many tasks** to annotate
3. **For each task**:
   - Rate the screenshot (0-10)
   - List any issues you notice
   - Explain your reasoning

---

## 🎯 Full Workflow

For more options:

```bash
npm run annotate:full
```

This gives you a menu with:
- Create tasks from dataset
- List pending tasks
- Annotate specific task
- Batch annotate
- Validate quality
- Integrate annotations
- Show statistics

---

## ✅ After Annotating

### Integrate Your Annotations

```bash
node evaluation/utils/collect-human-annotations.mjs integrate
```

### Validate Quality

```bash
npm run validate:annotations
```

### Match with VLLM (for calibration)

```bash
npm run match:vllm
```

---

## 📊 Check Progress

```bash
npm run annotate:full
# Choose option 7: Show statistics
```

---

## 💡 Tips

- **Be consistent**: Use similar criteria across annotations
- **Be thorough**: Include all issues you notice
- **Compare with VLLM**: If shown, consider the AI's judgment but use your own
- **Take breaks**: Don't annotate too many at once

---

## 🆘 Need Help?

See `ANNOTATION_QUICK_START.md` for detailed instructions.

---

## 🎉 Ready?

```bash
npm run annotate
```

**Start annotating now!**

