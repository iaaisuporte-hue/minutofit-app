// Registra todas as modalidades na inicialização do módulo
import './sports/jiuJitsu.config';

export { getSportConfig, getRegisteredSports, isValidSportKey, registerSport } from './registry';
export type { SportConfig, SportKey, SportContext, SportFactor, SportProfile, PreWorkoutCheckinData, ReadinessSnapshot, CompetitionCamp, CampWithDerived, SportDashboard, RiskLevel, CampPhase } from './sportConfig.types';
