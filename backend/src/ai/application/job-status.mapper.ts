import type { JobRecord } from '../../jobs/job.repository';
import { JobStatusDto } from '../dto/generate-book-response.dto';

export function toJobStatusDto(job: JobRecord): JobStatusDto {
  return {
    id: job.id,
    status: job.status,
    progress: job.status === 'completed' ? 100 : undefined,
    book: job.book,
    error: job.error,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  };
}
