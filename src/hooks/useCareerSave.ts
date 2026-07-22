import { useCallback, useEffect, useState } from "react";
import type { TrainingIntensity, WeeklyPlanTemplateId } from "../core/life/types";
import type { TrainingFocusId } from "../sports/football/training/types";
import type { RecruitingActionId } from "../sports/football/recruiting/types";
import { careerRepository } from "../storage/saves/CareerRepository";
import type { CareerSave } from "../storage/saves/schema";

interface CareerSaveState {
  save?: CareerSave;
  loading: boolean;
  mutating: boolean;
  error?: string;
  actionError?: string;
  updateWeeklyPlan(templateId: WeeklyPlanTemplateId, intensity: TrainingIntensity): Promise<void>;
  updateTrainingPlan(focusId: TrainingFocusId, intensity: TrainingIntensity): Promise<void>;
  advanceDay(): Promise<void>;
  startMatch(): Promise<void>;
  resolveMatchDecision(optionId: string): Promise<void>;
  resolveRelationshipEvent(optionId: string): Promise<void>;
  performRecruitingAction(programId: string, actionId: RecruitingActionId): Promise<void>;
  commitToCollege(programId: string): Promise<void>;
  withdrawCollegeCommitment(): Promise<void>;
}

export function useCareerSave(careerId: string | undefined): CareerSaveState {
  const [save, setSave] = useState<CareerSave>();
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [error, setError] = useState<string>();
  const [actionError, setActionError] = useState<string>();

  useEffect(() => {
    let cancelled = false;

    if (!careerId) {
      setLoading(false);
      setError("Не указан ID карьеры");
      return;
    }

    setLoading(true);
    setError(undefined);

    void careerRepository
      .load(careerId)
      .then((loadedSave) => {
        if (!cancelled) {
          setSave(loadedSave);
          setLoading(false);
        }
      })
      .catch((caught: unknown) => {
        console.error(caught);
        if (!cancelled) {
          setError("Сохранение повреждено или отсутствует");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [careerId]);

  const updateWeeklyPlan = useCallback(async (templateId: WeeklyPlanTemplateId, intensity: TrainingIntensity) => {
    if (!careerId || mutating) return;
    setMutating(true);
    setActionError(undefined);
    try {
      setSave(await careerRepository.updateWeeklyPlan(careerId, templateId, intensity));
    } catch (caught) {
      console.error(caught);
      setActionError("Не удалось сохранить недельный план.");
    } finally {
      setMutating(false);
    }
  }, [careerId, mutating]);

  const updateTrainingPlan = useCallback(async (focusId: TrainingFocusId, intensity: TrainingIntensity) => {
    if (!careerId || mutating) return;
    setMutating(true);
    setActionError(undefined);
    try {
      setSave(await careerRepository.updateTrainingPlan(careerId, focusId, intensity));
    } catch (caught) {
      console.error(caught);
      setActionError("Не удалось сохранить тренировочный план.");
    } finally {
      setMutating(false);
    }
  }, [careerId, mutating]);

  const advanceDay = useCallback(async () => {
    if (!careerId || mutating) return;
    setMutating(true);
    setActionError(undefined);
    try {
      setSave(await careerRepository.advanceDay(careerId));
    } catch (caught) {
      console.error(caught);
      setActionError("Не удалось завершить игровой день.");
    } finally {
      setMutating(false);
    }
  }, [careerId, mutating]);


  const startMatch = useCallback(async () => {
    if (!careerId || mutating) return;
    setMutating(true);
    setActionError(undefined);
    try {
      setSave(await careerRepository.startMatch(careerId));
    } catch (caught) {
      console.error(caught);
      setActionError("Не удалось начать матч.");
    } finally {
      setMutating(false);
    }
  }, [careerId, mutating]);

  const resolveMatchDecision = useCallback(async (optionId: string) => {
    if (!careerId || mutating) return;
    setMutating(true);
    setActionError(undefined);
    try {
      setSave(await careerRepository.resolveMatchDecision(careerId, optionId));
    } catch (caught) {
      console.error(caught);
      setActionError("Не удалось рассчитать игровой эпизод.");
    } finally {
      setMutating(false);
    }
  }, [careerId, mutating]);

  const resolveRelationshipEvent = useCallback(async (optionId: string) => {
    if (!careerId || mutating) return;
    setMutating(true);
    setActionError(undefined);
    try {
      setSave(await careerRepository.resolveRelationshipEvent(careerId, optionId));
    } catch (caught) {
      console.error(caught);
      setActionError("Не удалось завершить разговор.");
    } finally {
      setMutating(false);
    }
  }, [careerId, mutating]);

  const performRecruitingAction = useCallback(async (programId: string, actionId: RecruitingActionId) => {
    if (!careerId || mutating) return;
    setMutating(true);
    setActionError(undefined);
    try {
      setSave(await careerRepository.performRecruitingAction(careerId, programId, actionId));
    } catch (caught) {
      console.error(caught);
      setActionError("Не удалось выполнить действие в рекрутинге.");
    } finally {
      setMutating(false);
    }
  }, [careerId, mutating]);

  const commitToCollege = useCallback(async (programId: string) => {
    if (!careerId || mutating) return;
    setMutating(true);
    setActionError(undefined);
    try {
      setSave(await careerRepository.commitToCollege(careerId, programId));
    } catch (caught) {
      console.error(caught);
      setActionError("Не удалось подтвердить выбор колледжа.");
    } finally {
      setMutating(false);
    }
  }, [careerId, mutating]);

  const withdrawCollegeCommitment = useCallback(async () => {
    if (!careerId || mutating) return;
    setMutating(true);
    setActionError(undefined);
    try {
      setSave(await careerRepository.withdrawCollegeCommitment(careerId));
    } catch (caught) {
      console.error(caught);
      setActionError("Не удалось отозвать устный коммит.");
    } finally {
      setMutating(false);
    }
  }, [careerId, mutating]);

  return {
    ...(save ? { save } : {}),
    loading,
    mutating,
    ...(error ? { error } : {}),
    ...(actionError ? { actionError } : {}),
    updateWeeklyPlan,
    updateTrainingPlan,
    advanceDay,
    startMatch,
    resolveMatchDecision,
    resolveRelationshipEvent,
    performRecruitingAction,
    commitToCollege,
    withdrawCollegeCommitment,
  };
}
