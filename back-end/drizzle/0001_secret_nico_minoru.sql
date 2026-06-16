ALTER TABLE "questions" DROP CONSTRAINT "questions_position_positive";--> statement-breakpoint
DROP INDEX "questions_question_set_position_idx";--> statement-breakpoint
ALTER TABLE "quiz_sessions" ADD COLUMN "question_order_ids" uuid[] NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" DROP COLUMN "position";--> statement-breakpoint
ALTER TABLE "quiz_sessions" ADD CONSTRAINT "quiz_sessions_question_order_ids_non_empty" CHECK (cardinality("quiz_sessions"."question_order_ids") > 0);
