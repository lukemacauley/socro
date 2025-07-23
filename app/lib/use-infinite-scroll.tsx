import { useRef, useCallback } from "react";

export function useInfiniteScroll(callback: () => void, hasMore: boolean) {
  const observer = useRef<IntersectionObserver | null>(null);

  const lastElementRef = useCallback(
    (node: HTMLElement | null) => {
      if (observer.current) {
        observer.current.disconnect();
      }

      if (!hasMore) {
        return;
      }

      observer.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) {
            callback();
          }
        },
        {
          threshold: 0.1,
          rootMargin: "100px",
        }
      );

      if (node) {
        observer.current.observe(node);
      }
    },
    [callback, hasMore]
  );

  return lastElementRef;
}
