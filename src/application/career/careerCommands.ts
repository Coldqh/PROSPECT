import { careerRepository } from "../../storage/saves/CareerRepository";
import { CareerCommandService } from "./CareerCommandService";

export const careerCommands = new CareerCommandService(careerRepository);
