import { useEffect, useLayoutEffect } from 'react';

export function useAutoScrollToBottom<TElement extends HTMLElement>(
  element: TElement | null,
  enabled: boolean,
  contentKey: string,
): void {
  useLayoutEffect(() => {
    if (!enabled || !element) {
      return;
    }

    scheduleScrollToBottom(element);
  }, [contentKey, element, enabled]);

  useEffect(() => {
    if (!enabled || !element) {
      return;
    }

    const queueScroll = () => {
      scheduleScrollToBottom(element);
    };
    const resizeObserver = new ResizeObserver(() => {
      queueScroll();
    });
    const mutationObserver = new MutationObserver(() => {
      queueScroll();
    });

    resizeObserver.observe(element);
    mutationObserver.observe(element, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    queueScroll();

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [contentKey, element, enabled]);
}

function scheduleScrollToBottom(element: HTMLElement): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      element.scrollTop = element.scrollHeight;
    });
  });
}