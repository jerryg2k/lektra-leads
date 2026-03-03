CREATE TABLE `contacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`firstName` varchar(128),
	`lastName` varchar(128),
	`title` varchar(255),
	`email` varchar(320),
	`phone` varchar(64),
	`linkedinUrl` varchar(512),
	`twitterUrl` varchar(512),
	`isPrimary` boolean DEFAULT false,
	`fitReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `contacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`companyName` varchar(255) NOT NULL,
	`website` varchar(512),
	`description` text,
	`industry` varchar(128),
	`subIndustry` varchar(128),
	`location` varchar(255),
	`headcount` varchar(64),
	`linkedinUrl` varchar(512),
	`fundingStage` enum('Pre-Seed','Seed','Series A','Series B','Series C','Series D+','Unknown') DEFAULT 'Unknown',
	`totalFunding` varchar(64),
	`lastFundingDate` varchar(64),
	`investors` text,
	`gpuUseCases` json DEFAULT ('[]'),
	`techStack` text,
	`aiProducts` text,
	`estimatedGpuSpend` varchar(64),
	`score` float DEFAULT 0,
	`scoreBreakdown` json DEFAULT ('{}'),
	`pipelineStage` enum('New','Contacted','Qualified','Closed Won','Closed Lost') DEFAULT 'New',
	`lektraFitReason` text,
	`recommendedGpu` enum('H200','RTX Pro 6000','B200','Multiple','TBD') DEFAULT 'TBD',
	`source` varchar(128),
	`isArchived` boolean DEFAULT false,
	`assignedTo` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`authorName` varchar(255),
	`content` text NOT NULL,
	`noteType` enum('Note','Call','Email','Meeting','Follow-up') DEFAULT 'Note',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notes_id` PRIMARY KEY(`id`)
);
