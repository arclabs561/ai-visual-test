---
license: other
---

This data accompanies the WebUI project (https://dl.acm.org/doi/abs/10.1145/3544548.3581158)

For more information, check out the project website: https://uimodeling.github.io/


To download this dataset, you need to install the huggingface-hub package
```
pip install huggingface-hub
```

Use snapshot_download

```
from huggingface_hub import snapshot_download
snapshot_download(repo_id="biglab/webui-7k", repo_type="dataset")
```


IMPORTANT

* Before downloading and using, please review the copyright info here: https://github.com/js0nwu/webui/blob/main/COPYRIGHT.txt
* Not all data samples have the same number of files (e.g., same number of device screenshots) due to the fact that the crawler used a timeout during collection
* The dataset released on HuggingFace was filtered using a list of explicit words and therefore contains fewer samples than the experiments originally used in the paper. The raw dataset is currently available (https://drive.google.com/drive/folders/1hcO75W2FjsZoibsj2TIbKz67hy9JkOBz?usp=share_link) but may be removed in the future.