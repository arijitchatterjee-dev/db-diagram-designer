const UNITS = [
  ['year', 31536000],
  ['month', 2592000],
  ['week', 604800],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
];

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

/** "3 hours ago" reads faster than a timestamp when scanning a list. */
export function relativeTime(value) {
  if (!value) return '';
  const seconds = (Date.now() - new Date(value).getTime()) / 1000;
  if (seconds < 45) return 'just now';

  for (const [unit, size] of UNITS) {
    if (seconds >= size) return rtf.format(-Math.round(seconds / size), unit);
  }
  return 'just now';
}

export function absoluteTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}
