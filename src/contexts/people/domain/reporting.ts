import { BadRequestException } from '@nestjs/common';

/**
 * Reject a reporting line that leads back to the employee. Cycles are not a
 * theoretical worry: the org section walks `manager` upward, so A→B→A renders
 * forever. Pure, so the walk itself stays in the repository.
 *
 * @param chain manager ids from the proposed manager upward, nearest first
 * @param employeeId the employee being edited
 */
export function assertNoCycle(chain: string[], employeeId: string): void {
  if (chain.includes(employeeId)) {
    throw new BadRequestException('That reporting line loops back to this employee.');
  }
}
