CREATE TABLE "release_pull_requests" (
    "release_id" TEXT NOT NULL,
    "github_task_link_id" TEXT NOT NULL,

    CONSTRAINT "release_pull_requests_pkey" PRIMARY KEY ("release_id","github_task_link_id")
);

CREATE INDEX "release_pull_requests_github_task_link_id_idx" ON "release_pull_requests"("github_task_link_id");

ALTER TABLE "release_pull_requests" ADD CONSTRAINT "release_pull_requests_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "releases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "release_pull_requests" ADD CONSTRAINT "release_pull_requests_github_task_link_id_fkey" FOREIGN KEY ("github_task_link_id") REFERENCES "github_task_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;
