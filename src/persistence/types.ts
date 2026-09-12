export type DatabaseQueryResult<T> = {
  rows: T[];
  rowCount: number;
};

export interface DatabaseExecutor {
  query<T = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<DatabaseQueryResult<T>>;
}

export interface DatabasePool extends DatabaseExecutor {
  withTransaction<T>(work: (executor: DatabaseExecutor) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}