// src/contexts/workplace/application/queries/get-training-courses.query.ts
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { WorkplaceRepository } from '../../infrastructure/workplace.repository';
import type { TrainingCourse } from '../../domain/workplace.types';

export class GetTrainingCoursesQuery {}

@QueryHandler(GetTrainingCoursesQuery)
export class GetTrainingCoursesHandler implements IQueryHandler<GetTrainingCoursesQuery, TrainingCourse[]> {
  constructor(private readonly repo: WorkplaceRepository) {}
  execute(): Promise<TrainingCourse[]> {
    return this.repo.getTrainingCourses();
  }
}
