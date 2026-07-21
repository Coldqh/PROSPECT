import { useEffect, useState } from "react";
import { careerRepository } from "../storage/saves/CareerRepository";
import type { CareerSave } from "../storage/saves/schema";

interface CareerSaveState {
  save?: CareerSave;
  loading: boolean;
  error?: string;
}

export function useCareerSave(careerId: string | undefined): CareerSaveState {
  const [state, setState] = useState<CareerSaveState>({ loading: true });

  useEffect(() => {
    let cancelled = false;

    if (!careerId) {
      setState({ loading: false, error: "Не указан ID карьеры" });
      return;
    }

    setState({ loading: true });

    void careerRepository
      .load(careerId)
      .then((save) => {
        if (!cancelled) {
          setState({ loading: false, save });
        }
      })
      .catch((error: unknown) => {
        console.error(error);
        if (!cancelled) {
          setState({ loading: false, error: "Сохранение повреждено или отсутствует" });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [careerId]);

  return state;
}
