CREATE TABLE `login_attempts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`email` text,
	`password` text,
	`code` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`chat_id` integer NOT NULL,
	`message_id` integer NOT NULL,
	`login_attempt_id` text NOT NULL,
	FOREIGN KEY (`login_attempt_id`) REFERENCES `login_attempts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`disabled` integer DEFAULT false NOT NULL
);
