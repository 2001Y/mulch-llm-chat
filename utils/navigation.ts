import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

export const navigateWithTransition = (
  router: AppRouterInstance,
  href: string
) => {
  if (window.innerWidth > 768) {
    router.push(href);
    return;
  }

  if (document.startViewTransition) {
    document.startViewTransition(() => {
      router.push(href);
    });
  } else {
    router.push(href);
  }
};
