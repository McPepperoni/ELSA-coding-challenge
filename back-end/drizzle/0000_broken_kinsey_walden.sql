-- AI Generated code <PURPOSE>: create durable quiz PostgreSQL data model
CREATE TYPE "public"."quiz_session_status" AS ENUM('waiting_room', 'question_active', 'question_reveal', 'finished');--> statement-breakpoint
CREATE TABLE "answer_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"option_text" text NOT NULL,
	"position" integer NOT NULL,
	"is_correct" boolean NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "answer_options_text_not_blank" CHECK (length(trim("answer_options"."option_text")) > 0),
	CONSTRAINT "answer_options_position_positive" CHECK ("answer_options"."position" > 0)
);
--> statement-breakpoint
CREATE TABLE "answer_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_session_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"selected_option_id" uuid NOT NULL,
	"is_correct" boolean NOT NULL,
	"score_awarded" integer NOT NULL,
	"submitted_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "answer_submissions_score_non_negative" CHECK ("answer_submissions"."score_awarded" >= 0)
);
--> statement-breakpoint
CREATE TABLE "final_results" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_session_id" uuid NOT NULL,
	"participant_id" uuid NOT NULL,
	"rank" integer NOT NULL,
	"score" integer NOT NULL,
	"correct_answer_count" integer NOT NULL,
	"last_correct_submission_at" timestamp with time zone,
	"joined_at" timestamp with time zone NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "final_results_rank_positive" CHECK ("final_results"."rank" > 0),
	CONSTRAINT "final_results_score_non_negative" CHECK ("final_results"."score" >= 0),
	CONSTRAINT "final_results_correct_count_non_negative" CHECK ("final_results"."correct_answer_count" >= 0)
);
--> statement-breakpoint
CREATE TABLE "participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_session_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"participant_token_hash" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone,
	CONSTRAINT "participants_display_name_not_blank" CHECK (length(trim("participants"."display_name")) > 0),
	CONSTRAINT "participants_token_hash_not_blank" CHECK (length(trim("participants"."participant_token_hash")) > 0)
);
--> statement-breakpoint
CREATE TABLE "question_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"default_time_limit_seconds" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "question_sets_title_not_blank" CHECK (length(trim("question_sets"."title")) > 0),
	CONSTRAINT "question_sets_default_time_limit_range" CHECK ("question_sets"."default_time_limit_seconds" between 5 and 300)
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_set_id" uuid NOT NULL,
	"prompt" text NOT NULL,
	"position" integer NOT NULL,
	"time_limit_seconds" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "questions_prompt_not_blank" CHECK (length(trim("questions"."prompt")) > 0),
	CONSTRAINT "questions_position_positive" CHECK ("questions"."position" > 0),
	CONSTRAINT "questions_time_limit_range" CHECK ("questions"."time_limit_seconds" is null or "questions"."time_limit_seconds" between 5 and 300)
);
--> statement-breakpoint
CREATE TABLE "quiz_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_set_id" uuid NOT NULL,
	"quiz_code" text NOT NULL,
	"status" "quiz_session_status" DEFAULT 'waiting_room' NOT NULL,
	"current_question_position" integer,
	"host_token_hash" text NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quiz_sessions_quiz_code_not_blank" CHECK (length(trim("quiz_sessions"."quiz_code")) > 0),
	CONSTRAINT "quiz_sessions_host_token_hash_not_blank" CHECK (length(trim("quiz_sessions"."host_token_hash")) > 0),
	CONSTRAINT "quiz_sessions_current_question_position_positive" CHECK ("quiz_sessions"."current_question_position" is null or "quiz_sessions"."current_question_position" > 0)
);
--> statement-breakpoint
ALTER TABLE "answer_options" ADD CONSTRAINT "answer_options_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answer_submissions" ADD CONSTRAINT "answer_submissions_quiz_session_id_quiz_sessions_id_fk" FOREIGN KEY ("quiz_session_id") REFERENCES "public"."quiz_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answer_submissions" ADD CONSTRAINT "answer_submissions_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answer_submissions" ADD CONSTRAINT "answer_submissions_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "answer_submissions" ADD CONSTRAINT "answer_submissions_selected_option_id_answer_options_id_fk" FOREIGN KEY ("selected_option_id") REFERENCES "public"."answer_options"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "final_results" ADD CONSTRAINT "final_results_quiz_session_id_quiz_sessions_id_fk" FOREIGN KEY ("quiz_session_id") REFERENCES "public"."quiz_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "final_results" ADD CONSTRAINT "final_results_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "public"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "participants" ADD CONSTRAINT "participants_quiz_session_id_quiz_sessions_id_fk" FOREIGN KEY ("quiz_session_id") REFERENCES "public"."quiz_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_question_set_id_question_sets_id_fk" FOREIGN KEY ("question_set_id") REFERENCES "public"."question_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_sessions" ADD CONSTRAINT "quiz_sessions_question_set_id_question_sets_id_fk" FOREIGN KEY ("question_set_id") REFERENCES "public"."question_sets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "answer_options_question_position_idx" ON "answer_options" USING btree ("question_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "answer_options_one_correct_per_question_idx" ON "answer_options" USING btree ("question_id") WHERE "answer_options"."is_correct" = true;--> statement-breakpoint
CREATE INDEX "answer_options_question_id_idx" ON "answer_options" USING btree ("question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "answer_submissions_once_per_question_idx" ON "answer_submissions" USING btree ("quiz_session_id","participant_id","question_id");--> statement-breakpoint
CREATE INDEX "answer_submissions_session_question_idx" ON "answer_submissions" USING btree ("quiz_session_id","question_id");--> statement-breakpoint
CREATE INDEX "answer_submissions_participant_id_idx" ON "answer_submissions" USING btree ("participant_id");--> statement-breakpoint
CREATE INDEX "answer_submissions_submitted_at_idx" ON "answer_submissions" USING btree ("submitted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "final_results_session_participant_idx" ON "final_results" USING btree ("quiz_session_id","participant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "final_results_session_rank_idx" ON "final_results" USING btree ("quiz_session_id","rank");--> statement-breakpoint
CREATE INDEX "final_results_session_rank_read_idx" ON "final_results" USING btree ("quiz_session_id","rank");--> statement-breakpoint
CREATE UNIQUE INDEX "participants_token_hash_idx" ON "participants" USING btree ("participant_token_hash");--> statement-breakpoint
CREATE INDEX "participants_session_joined_at_idx" ON "participants" USING btree ("quiz_session_id","joined_at");--> statement-breakpoint
CREATE INDEX "question_sets_created_at_idx" ON "question_sets" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "questions_question_set_position_idx" ON "questions" USING btree ("question_set_id","position");--> statement-breakpoint
CREATE INDEX "questions_question_set_id_idx" ON "questions" USING btree ("question_set_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quiz_sessions_quiz_code_idx" ON "quiz_sessions" USING btree ("quiz_code");--> statement-breakpoint
CREATE UNIQUE INDEX "quiz_sessions_host_token_hash_idx" ON "quiz_sessions" USING btree ("host_token_hash");--> statement-breakpoint
CREATE INDEX "quiz_sessions_question_set_id_idx" ON "quiz_sessions" USING btree ("question_set_id");--> statement-breakpoint
CREATE INDEX "quiz_sessions_status_idx" ON "quiz_sessions" USING btree ("status");
