/** Browser-local date/time makes automatic checkpoints recognizable in the saved-game list. */
export function checkpointStamp(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}
export function defaultCheckpointName(seed: number, date = new Date()): string {
  return `${checkpointStamp(date)} · seed ${seed}`;
}
