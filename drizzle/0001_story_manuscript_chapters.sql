CREATE TABLE `story_manuscript_chapters` (
  `owner` text NOT NULL,
  `book_id` text NOT NULL,
  `outline_card_id` text NOT NULL,
  `content` text DEFAULT '' NOT NULL,
  `revision_notes` text DEFAULT '' NOT NULL,
  `revision` integer DEFAULT 0 NOT NULL,
  `updated_at` text NOT NULL,
  PRIMARY KEY (`owner`,`book_id`,`outline_card_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_story_manuscript_owner_book` ON `story_manuscript_chapters` (`owner`,`book_id`);
