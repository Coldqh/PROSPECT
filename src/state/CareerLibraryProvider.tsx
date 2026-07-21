import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { careerRepository } from "../storage/saves/CareerRepository";
import type { CareerIndexRecord, CareerSave } from "../storage/saves/schema";

interface CareerLibraryContextValue {
  careers: CareerIndexRecord[];
  loading: boolean;
  error?: string;
  refresh(): Promise<void>;
  createFootballCareer(): Promise<CareerSave>;
  removeCareer(careerId: string): Promise<void>;
  importCareer(file: File): Promise<CareerSave>;
  exportCareer(careerId: string): Promise<Blob>;
}

const CareerLibraryContext = createContext<CareerLibraryContextValue | undefined>(undefined);

export function CareerLibraryProvider({ children }: { children: ReactNode }) {
  const [careers, setCareers] = useState<CareerIndexRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);

    try {
      setCareers(await careerRepository.list());
    } catch (caught) {
      console.error(caught);
      setError("Не удалось прочитать локальные сохранения.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createFootballCareer = useCallback(async () => {
    const save = await careerRepository.createFootballCareer();
    await refresh();
    return save;
  }, [refresh]);

  const removeCareer = useCallback(async (careerId: string) => {
    await careerRepository.remove(careerId);
    await refresh();
  }, [refresh]);

  const importCareer = useCallback(async (file: File) => {
    const save = await careerRepository.import(file);
    await refresh();
    return save;
  }, [refresh]);

  const exportCareer = useCallback((careerId: string) => careerRepository.export(careerId), []);

  const value = useMemo<CareerLibraryContextValue>(
    () => ({
      careers,
      loading,
      ...(error ? { error } : {}),
      refresh,
      createFootballCareer,
      removeCareer,
      importCareer,
      exportCareer,
    }),
    [careers, loading, error, refresh, createFootballCareer, removeCareer, importCareer, exportCareer],
  );

  return <CareerLibraryContext.Provider value={value}>{children}</CareerLibraryContext.Provider>;
}

export function useCareerLibrary(): CareerLibraryContextValue {
  const context = useContext(CareerLibraryContext);

  if (!context) {
    throw new Error("useCareerLibrary must be used inside CareerLibraryProvider");
  }

  return context;
}
