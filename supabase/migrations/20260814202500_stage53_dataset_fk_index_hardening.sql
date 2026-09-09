-- XEOMX Stage 5.3: cover the two composite Dataset/Evals foreign keys
-- reported by the staging Performance Advisor after the foundation apply.

CREATE INDEX dataset_versions_dataset_project_idx
  ON public.dataset_versions(dataset_id, project_id);

CREATE INDEX dataset_items_version_dataset_project_idx
  ON public.dataset_items(dataset_version_id, dataset_id, project_id);

