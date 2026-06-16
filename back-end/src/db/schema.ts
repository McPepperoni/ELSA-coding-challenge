// AI Generated code <PURPOSE>: define durable quiz PostgreSQL schema
import { sql } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

export const quizSessionStatusValues = [
  'waiting_room',
  'question_active',
  'question_reveal',
  'finished',
] as const

export const quizSessionStatusEnum = pgEnum('quiz_session_status', quizSessionStatusValues)

export const questionSets = pgTable(
  'question_sets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    title: text('title').notNull(),
    defaultTimeLimitSeconds: integer('default_time_limit_seconds').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    check('question_sets_title_not_blank', sql`length(trim(${table.title})) > 0`),
    check(
      'question_sets_default_time_limit_range',
      sql`${table.defaultTimeLimitSeconds} between 5 and 300`,
    ),
    index('question_sets_created_at_idx').on(table.createdAt),
  ],
)

export const questions = pgTable(
  'questions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    questionSetId: uuid('question_set_id')
      .notNull()
      .references(() => questionSets.id, { onDelete: 'cascade' }),
    prompt: text('prompt').notNull(),
    timeLimitSeconds: integer('time_limit_seconds'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('questions_question_set_id_idx').on(table.questionSetId),
    check('questions_prompt_not_blank', sql`length(trim(${table.prompt})) > 0`),
    check(
      'questions_time_limit_range',
      sql`${table.timeLimitSeconds} is null or ${table.timeLimitSeconds} between 5 and 300`,
    ),
  ],
)

export const answerOptions = pgTable(
  'answer_options',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    optionText: text('option_text').notNull(),
    position: integer('position').notNull(),
    isCorrect: boolean('is_correct').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('answer_options_question_position_idx').on(table.questionId, table.position),
    uniqueIndex('answer_options_one_correct_per_question_idx')
      .on(table.questionId)
      .where(sql`${table.isCorrect} = true`),
    index('answer_options_question_id_idx').on(table.questionId),
    check('answer_options_text_not_blank', sql`length(trim(${table.optionText})) > 0`),
    check('answer_options_position_positive', sql`${table.position} > 0`),
  ],
)

export const quizSessions = pgTable(
  'quiz_sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    questionSetId: uuid('question_set_id')
      .notNull()
      .references(() => questionSets.id, { onDelete: 'restrict' }),
    quizCode: text('quiz_code').notNull(),
    status: quizSessionStatusEnum('status').notNull().default('waiting_room'),
    currentQuestionPosition: integer('current_question_position'),
    questionOrderIds: uuid('question_order_ids').array().notNull(),
    hostTokenHash: text('host_token_hash').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('quiz_sessions_quiz_code_idx').on(table.quizCode),
    uniqueIndex('quiz_sessions_host_token_hash_idx').on(table.hostTokenHash),
    index('quiz_sessions_question_set_id_idx').on(table.questionSetId),
    index('quiz_sessions_status_idx').on(table.status),
    check('quiz_sessions_quiz_code_not_blank', sql`length(trim(${table.quizCode})) > 0`),
    check('quiz_sessions_host_token_hash_not_blank', sql`length(trim(${table.hostTokenHash})) > 0`),
    check(
      'quiz_sessions_current_question_position_positive',
      sql`${table.currentQuestionPosition} is null or ${table.currentQuestionPosition} > 0`,
    ),
    check(
      'quiz_sessions_question_order_ids_non_empty',
      sql`cardinality(${table.questionOrderIds}) > 0`,
    ),
  ],
)

export const participants = pgTable(
  'participants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    quizSessionId: uuid('quiz_session_id')
      .notNull()
      .references(() => quizSessions.id, { onDelete: 'cascade' }),
    displayName: text('display_name').notNull(),
    participantTokenHash: text('participant_token_hash').notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('participants_token_hash_idx').on(table.participantTokenHash),
    index('participants_session_joined_at_idx').on(table.quizSessionId, table.joinedAt),
    check('participants_display_name_not_blank', sql`length(trim(${table.displayName})) > 0`),
    check(
      'participants_token_hash_not_blank',
      sql`length(trim(${table.participantTokenHash})) > 0`,
    ),
  ],
)

export const answerSubmissions = pgTable(
  'answer_submissions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    quizSessionId: uuid('quiz_session_id')
      .notNull()
      .references(() => quizSessions.id, { onDelete: 'cascade' }),
    participantId: uuid('participant_id')
      .notNull()
      .references(() => participants.id, { onDelete: 'cascade' }),
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'restrict' }),
    selectedOptionId: uuid('selected_option_id')
      .notNull()
      .references(() => answerOptions.id, { onDelete: 'restrict' }),
    isCorrect: boolean('is_correct').notNull(),
    scoreAwarded: integer('score_awarded').notNull(),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('answer_submissions_once_per_question_idx').on(
      table.quizSessionId,
      table.participantId,
      table.questionId,
    ),
    index('answer_submissions_session_question_idx').on(table.quizSessionId, table.questionId),
    index('answer_submissions_participant_id_idx').on(table.participantId),
    index('answer_submissions_submitted_at_idx').on(table.submittedAt),
    check('answer_submissions_score_non_negative', sql`${table.scoreAwarded} >= 0`),
  ],
)

export const finalResults = pgTable(
  'final_results',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    quizSessionId: uuid('quiz_session_id')
      .notNull()
      .references(() => quizSessions.id, { onDelete: 'cascade' }),
    participantId: uuid('participant_id')
      .notNull()
      .references(() => participants.id, { onDelete: 'cascade' }),
    rank: integer('rank').notNull(),
    score: integer('score').notNull(),
    correctAnswerCount: integer('correct_answer_count').notNull(),
    lastCorrectSubmissionAt: timestamp('last_correct_submission_at', { withTimezone: true }),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull(),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('final_results_session_participant_idx').on(table.quizSessionId, table.participantId),
    uniqueIndex('final_results_session_rank_idx').on(table.quizSessionId, table.rank),
    index('final_results_session_rank_read_idx').on(table.quizSessionId, table.rank),
    check('final_results_rank_positive', sql`${table.rank} > 0`),
    check('final_results_score_non_negative', sql`${table.score} >= 0`),
    check('final_results_correct_count_non_negative', sql`${table.correctAnswerCount} >= 0`),
  ],
)

export type QuestionSet = typeof questionSets.$inferSelect
export type Question = typeof questions.$inferSelect
export type AnswerOption = typeof answerOptions.$inferSelect
export type QuizSession = typeof quizSessions.$inferSelect
export type QuizSessionStatus = (typeof quizSessionStatusValues)[number]
export type Participant = typeof participants.$inferSelect
export type AnswerSubmission = typeof answerSubmissions.$inferSelect
export type FinalResult = typeof finalResults.$inferSelect
