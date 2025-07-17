import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

export default function RelativeTime({ date }: { date?: number | null }) {
  if (!date) {
    return "Unknown";
  }

  return dayjs(date).fromNow();
}
