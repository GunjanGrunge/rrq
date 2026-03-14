import { useRouter } from "next/navigation";
import { usePipelineStore } from "@/lib/pipeline-store";

export function useDirectorNavigation() {
  const router = useRouter();
  const { brief, openGate } = usePipelineStore();

  function proceedAfterScript() {
    if (brief?.directorMode) {
      openGate("gate-script");
      router.push("/create/approve-script");
    } else {
      router.push("/create/seo");
    }
  }

  function proceedAfterSEO() {
    if (brief?.directorMode) {
      openGate("gate-seo");
      router.push("/create/approve-seo");
    } else {
      router.push("/create/quality");
    }
  }

  function proceedAfterVisuals() {
    if (brief?.directorMode) {
      openGate("gate-visuals");
      router.push("/create/approve-visuals");
    } else {
      router.push("/create/av-sync");
    }
  }

  function proceedAfterVeraQA() {
    if (brief?.directorMode) {
      openGate("gate-publish");
      router.push("/create/approve-publish");
    } else {
      router.push("/create/shorts");
    }
  }

  return {
    proceedAfterScript,
    proceedAfterSEO,
    proceedAfterVisuals,
    proceedAfterVeraQA,
    isDirectorMode: brief?.directorMode ?? false,
  };
}
