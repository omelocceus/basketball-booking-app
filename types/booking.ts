export type TrainingType = "oncourt" | "sand" | "weight";

export type TimeSlot = {
  time_slot: string;
};

export type Booking = {
  id: number;
  name: string;
  email: string;
  phone?: string | null;
  date: string;
  time_slot: string;
  training_type: TrainingType;
  status: "pending" | "confirmed" | "cancelled" | "expired";
  amount_paid?: number | null;
  stripe_session_id?: string | null;
  created_at?: string;
};

export const trainingTypeLabels: Record<TrainingType, string> = {
  oncourt: "On Court Training - $60",
  sand: "Sand Training - $50",
  weight: "Weight Training - $50"
};
