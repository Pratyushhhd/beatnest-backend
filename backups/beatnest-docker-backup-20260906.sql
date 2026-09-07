-- MySQL dump 10.13  Distrib 8.0.46, for Linux (x86_64)
--
-- Host: localhost    Database: beatnest
-- ------------------------------------------------------
-- Server version	8.0.46

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `beatnest`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `beatnest` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;

USE `beatnest`;

--
-- Table structure for table `albums`
--

DROP TABLE IF EXISTS `albums`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `albums` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `artist_id` bigint unsigned DEFAULT NULL,
  `cover_image` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `release_date` date DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_albums_title_artist` (`title`,`artist_id`),
  KEY `idx_albums_artist` (`artist_id`),
  CONSTRAINT `fk_albums_artist` FOREIGN KEY (`artist_id`) REFERENCES `artists` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `albums`
--

LOCK TABLES `albums` WRITE;
/*!40000 ALTER TABLE `albums` DISABLE KEYS */;
INSERT INTO `albums` VALUES (1,'The Edge Band Collection',1,NULL,NULL,'2026-09-06 03:55:45','2026-09-06 03:55:45'),(2,'Neon Horizons',2,NULL,NULL,'2026-09-06 03:55:51','2026-09-06 03:55:51'),(3,'Quiet Currents',3,NULL,NULL,'2026-09-06 03:55:51','2026-09-06 03:55:51'),(4,'Afterglow',4,NULL,NULL,'2026-09-06 03:55:52','2026-09-06 03:55:52'),(5,'Coral Theory',5,NULL,NULL,'2026-09-06 03:55:52','2026-09-06 03:55:52'),(6,'Tracks North',6,NULL,NULL,'2026-09-06 03:55:53','2026-09-06 03:55:53'),(7,'Roots & Routes',7,NULL,NULL,'2026-09-06 03:55:53','2026-09-06 03:55:53'),(8,'Naya Din',8,NULL,NULL,'2026-09-06 03:55:53','2026-09-06 03:55:53'),(9,'Night Shift',9,NULL,NULL,'2026-09-06 03:55:54','2026-09-06 03:55:54'),(10,'Yatra',10,NULL,NULL,'2026-09-06 03:55:54','2026-09-06 03:55:54'),(11,'Tests',11,'/uploads/covers/e203cdb4-8e70-435d-bb21-a99f5523e562.png',NULL,'2026-09-06 03:56:08','2026-09-06 03:56:08');
/*!40000 ALTER TABLE `albums` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `artists`
--

DROP TABLE IF EXISTS `artists`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `artists` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `bio` text COLLATE utf8mb4_unicode_ci,
  `cover_image` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_artists_name` (`name`),
  KEY `idx_artists_created` (`created_at`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `artists`
--

LOCK TABLES `artists` WRITE;
/*!40000 ALTER TABLE `artists` DISABLE KEYS */;
INSERT INTO `artists` VALUES (1,'The Edge Band',NULL,NULL,NULL,'2026-09-06 03:55:45','2026-09-06 03:55:45'),(2,'Pixel Drift',NULL,NULL,NULL,'2026-09-06 03:55:51','2026-09-06 03:55:51'),(3,'Cedar Lane',NULL,NULL,NULL,'2026-09-06 03:55:51','2026-09-06 03:55:51'),(4,'Kira Volt',NULL,NULL,NULL,'2026-09-06 03:55:52','2026-09-06 03:55:52'),(5,'Maris Here',NULL,NULL,NULL,'2026-09-06 03:55:52','2026-09-06 03:55:52'),(6,'The North Line',NULL,NULL,NULL,'2026-09-06 03:55:53','2026-09-06 03:55:53'),(7,'Ravi Chandra',NULL,NULL,NULL,'2026-09-06 03:55:53','2026-09-06 03:55:53'),(8,'Sangita Maya',NULL,NULL,NULL,'2026-09-06 03:55:53','2026-09-06 03:55:53'),(9,'DJ Amara',NULL,NULL,NULL,'2026-09-06 03:55:54','2026-09-06 03:55:54'),(10,'Bikash Raute',NULL,NULL,NULL,'2026-09-06 03:55:54','2026-09-06 03:55:54'),(11,'Test Artist',NULL,NULL,NULL,'2026-09-06 03:56:08','2026-09-06 03:56:08');
/*!40000 ALTER TABLE `artists` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `downloads`
--

DROP TABLE IF EXISTS `downloads`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `downloads` (
  `user_id` bigint unsigned NOT NULL,
  `song_id` bigint unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`,`song_id`),
  KEY `idx_dl_song` (`song_id`),
  CONSTRAINT `fk_dl_song` FOREIGN KEY (`song_id`) REFERENCES `songs` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_dl_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `downloads`
--

LOCK TABLES `downloads` WRITE;
/*!40000 ALTER TABLE `downloads` DISABLE KEYS */;
/*!40000 ALTER TABLE `downloads` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `favorites`
--

DROP TABLE IF EXISTS `favorites`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `favorites` (
  `user_id` bigint unsigned NOT NULL,
  `song_id` bigint unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`,`song_id`),
  KEY `idx_fav_song` (`song_id`),
  CONSTRAINT `fk_fav_song` FOREIGN KEY (`song_id`) REFERENCES `songs` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_fav_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `favorites`
--

LOCK TABLES `favorites` WRITE;
/*!40000 ALTER TABLE `favorites` DISABLE KEYS */;
/*!40000 ALTER TABLE `favorites` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `followed_artists`
--

DROP TABLE IF EXISTS `followed_artists`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `followed_artists` (
  `user_id` bigint unsigned NOT NULL,
  `artist_id` bigint unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`,`artist_id`),
  KEY `idx_fol_artist` (`artist_id`),
  CONSTRAINT `fk_fol_artist` FOREIGN KEY (`artist_id`) REFERENCES `artists` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_fol_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `followed_artists`
--

LOCK TABLES `followed_artists` WRITE;
/*!40000 ALTER TABLE `followed_artists` DISABLE KEYS */;
/*!40000 ALTER TABLE `followed_artists` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `genres`
--

DROP TABLE IF EXISTS `genres`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `genres` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_genres_name` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `genres`
--

LOCK TABLES `genres` WRITE;
/*!40000 ALTER TABLE `genres` DISABLE KEYS */;
INSERT INTO `genres` VALUES (1,'Nepali Pop','2026-09-06 03:55:45'),(2,'Electronic','2026-09-06 03:55:51'),(3,'Folk','2026-09-06 03:55:51'),(4,'Acoustic','2026-09-06 03:55:51'),(5,'Pop','2026-09-06 03:55:52'),(6,'Lo-Fi','2026-09-06 03:55:52'),(7,'Ambient','2026-09-06 03:55:52'),(8,'Indie','2026-09-06 03:55:53'),(9,'Romantic','2026-09-06 03:55:53'),(10,'House','2026-09-06 03:55:54'),(11,'Devotional','2026-09-06 03:55:54');
/*!40000 ALTER TABLE `genres` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `listening_history`
--

DROP TABLE IF EXISTS `listening_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `listening_history` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned DEFAULT NULL,
  `song_id` bigint unsigned DEFAULT NULL,
  `played_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_history_user` (`user_id`,`played_at`),
  KEY `idx_history_song` (`song_id`),
  CONSTRAINT `fk_hist_song` FOREIGN KEY (`song_id`) REFERENCES `songs` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_hist_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `listening_history`
--

LOCK TABLES `listening_history` WRITE;
/*!40000 ALTER TABLE `listening_history` DISABLE KEYS */;
INSERT INTO `listening_history` VALUES (1,1,1,'2026-09-06 03:55:45');
/*!40000 ALTER TABLE `listening_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `playlist_songs`
--

DROP TABLE IF EXISTS `playlist_songs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `playlist_songs` (
  `playlist_id` bigint unsigned NOT NULL,
  `song_id` bigint unsigned NOT NULL,
  `position` int NOT NULL DEFAULT '0',
  `added_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`playlist_id`,`song_id`),
  KEY `idx_pls_song` (`song_id`),
  CONSTRAINT `fk_pls_playlist` FOREIGN KEY (`playlist_id`) REFERENCES `playlists` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_pls_song` FOREIGN KEY (`song_id`) REFERENCES `songs` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `playlist_songs`
--

LOCK TABLES `playlist_songs` WRITE;
/*!40000 ALTER TABLE `playlist_songs` DISABLE KEYS */;
INSERT INTO `playlist_songs` VALUES (1,1,0,'2026-09-06 03:55:45'),(1,2,1,'2026-09-06 03:55:45'),(1,3,2,'2026-09-06 03:55:46'),(1,4,3,'2026-09-06 03:55:46'),(1,5,4,'2026-09-06 03:55:46'),(1,6,5,'2026-09-06 03:55:46'),(2,11,5,'2026-09-06 03:56:02'),(2,12,3,'2026-09-06 03:56:02'),(2,16,4,'2026-09-06 03:56:02'),(2,18,2,'2026-09-06 03:56:02'),(2,19,0,'2026-09-06 03:56:02'),(2,23,1,'2026-09-06 03:56:02'),(3,24,0,'2026-09-06 03:56:02'),(4,11,5,'2026-09-06 04:12:27'),(4,12,3,'2026-09-06 04:12:27'),(4,16,4,'2026-09-06 04:12:27'),(4,18,2,'2026-09-06 04:12:27'),(4,19,0,'2026-09-06 04:12:27'),(4,23,1,'2026-09-06 04:12:27'),(5,24,0,'2026-09-06 04:12:27');
/*!40000 ALTER TABLE `playlist_songs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `playlists`
--

DROP TABLE IF EXISTS `playlists`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `playlists` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint unsigned NOT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `description` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `cover_image` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `is_public` tinyint(1) NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_playlists_user` (`user_id`),
  CONSTRAINT `fk_playlists_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `playlists`
--

LOCK TABLES `playlists` WRITE;
/*!40000 ALTER TABLE `playlists` DISABLE KEYS */;
INSERT INTO `playlists` VALUES (1,1,'My First Mix','Your starter playlist',NULL,0,'2026-09-06 03:55:45','2026-09-06 03:55:45');
/*!40000 ALTER TABLE `playlists` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `saved_albums`
--

DROP TABLE IF EXISTS `saved_albums`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `saved_albums` (
  `user_id` bigint unsigned NOT NULL,
  `album_id` bigint unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`,`album_id`),
  KEY `idx_sa_album` (`album_id`),
  CONSTRAINT `fk_sa_album` FOREIGN KEY (`album_id`) REFERENCES `albums` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_sa_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `saved_albums`
--

LOCK TABLES `saved_albums` WRITE;
/*!40000 ALTER TABLE `saved_albums` DISABLE KEYS */;
/*!40000 ALTER TABLE `saved_albums` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `songs`
--

DROP TABLE IF EXISTS `songs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `songs` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `title` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `artist_id` bigint unsigned DEFAULT NULL,
  `album_id` bigint unsigned DEFAULT NULL,
  `genre_id` bigint unsigned DEFAULT NULL,
  `language` varchar(60) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Other',
  `duration` int NOT NULL DEFAULT '0',
  `track_number` int NOT NULL DEFAULT '0',
  `release_date` date DEFAULT NULL,
  `plays` int NOT NULL DEFAULT '0',
  `audio_path` varchar(500) COLLATE utf8mb4_unicode_ci NOT NULL,
  `cover_path` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `featured` tinyint(1) NOT NULL DEFAULT '0',
  `license` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Owned',
  `created_by` bigint unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_songs_title` (`title`),
  KEY `idx_songs_artist` (`artist_id`),
  KEY `idx_songs_album` (`album_id`),
  KEY `idx_songs_genre` (`genre_id`),
  KEY `idx_songs_language` (`language`),
  KEY `idx_songs_plays` (`plays`),
  KEY `idx_songs_release` (`release_date`),
  KEY `fk_songs_creator` (`created_by`),
  CONSTRAINT `fk_songs_album` FOREIGN KEY (`album_id`) REFERENCES `albums` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_songs_artist` FOREIGN KEY (`artist_id`) REFERENCES `artists` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_songs_creator` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_songs_genre` FOREIGN KEY (`genre_id`) REFERENCES `genres` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB AUTO_INCREMENT=27 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `songs`
--

LOCK TABLES `songs` WRITE;
/*!40000 ALTER TABLE `songs` DISABLE KEYS */;
INSERT INTO `songs` VALUES (1,'Mero Aanshu',1,1,1,'Nepali',210,0,'2024-01-01',9,'/music/Mero Aanshu -The Edge Band I Jeewan Gurung.mp3','/uploads/covers/placeholder.png',1,'Artist-uploaded',NULL,'2026-09-06 03:55:45','2026-09-06 04:14:24'),(2,'Nachahe Ko Hoina',1,1,1,'Nepali',168,0,'2024-01-01',2,'/music/Nachahe ko Hoina - The Edge Band I Jeewan Gurung [0j4XhaDjDEE].mp3','/uploads/covers/placeholder.png',1,'Artist-uploaded',NULL,'2026-09-06 03:55:45','2026-09-06 03:55:45'),(3,'Prayas',1,1,1,'Nepali',200,0,'2024-01-01',0,'/music/Prayas -The Edge Band I Jeewan Gurung.mp3','/uploads/covers/placeholder.png',1,'Artist-uploaded',NULL,'2026-09-06 03:55:45','2026-09-06 03:55:45'),(4,'Samjhiney Mutu',1,1,1,'Nepali',208,0,'2024-01-01',0,'/music/Samjhiney Mutu -The Edge Band I Jeewan Gurung.mp3','/uploads/covers/placeholder.png',0,'Artist-uploaded',NULL,'2026-09-06 03:55:45','2026-09-06 03:55:45'),(5,'Thaha Chaina',1,1,1,'Nepali',172,0,'2024-01-01',2,'/music/Thaha chaina -The Edge Band I Jeewan Gurung [dJqtIgvofmg].mp3','/uploads/covers/placeholder.png',0,'Artist-uploaded',NULL,'2026-09-06 03:55:45','2026-09-06 03:55:45'),(6,'Yo Dil Mero',1,1,1,'Nepali',129,0,'2024-01-01',0,'/music/Yo dil Mero -The Edge Band I Jeewan Gurung.mp3','/uploads/covers/placeholder.png',0,'Artist-uploaded',NULL,'2026-09-06 03:55:45','2026-09-06 03:55:45'),(7,'Midnight Signals',2,2,2,'Instrumental',180,0,'2024-01-01',815,'/uploads/music/53ec2a9a-1cbd-4c31-9031-e9b0c4e2b7bd.wav','/uploads/covers/seed-76-209-196-108-92-231.png',1,'Artist-uploaded',NULL,'2026-09-06 03:55:51','2026-09-06 03:55:51'),(8,'Chasing Comets',2,2,2,'Instrumental',195,0,'2024-01-01',3475,'/uploads/music/9d82a8ee-2a6f-4b1a-9739-bfc8a53f290a.wav','/uploads/covers/seed-255-107-107-255-230-109.png',0,'Artist-uploaded',NULL,'2026-09-06 03:55:51','2026-09-06 03:55:51'),(9,'Paper Boats',3,3,3,'English',220,0,'2023-01-01',4746,'/uploads/music/1d0c6474-14fc-491c-905a-4b1b5f781ec1.wav','/uploads/covers/seed-199-125-255-224-170-255.png',0,'Artist-uploaded',NULL,'2026-09-06 03:55:51','2026-09-06 03:55:51'),(10,'Worth the Wait',3,3,4,'English',240,0,'2023-01-01',5945,'/uploads/music/1944d732-24c4-42ea-ab2d-b4dc64336512.wav','/uploads/covers/seed-255-159-67-255-234-167.png',1,'Artist-uploaded',NULL,'2026-09-06 03:55:52','2026-09-06 03:55:52'),(11,'Neon Rain',4,4,5,'English',205,0,'2025-01-01',6519,'/uploads/music/2c295604-347b-4f71-bf97-308de3f7aff3.wav','/uploads/covers/seed-253-121-168-253-207-232.png',1,'Artist-uploaded',NULL,'2026-09-06 03:55:52','2026-09-06 03:55:52'),(12,'Afterglow',4,4,5,'English',190,0,'2025-01-01',6741,'/uploads/music/7c214b90-75c4-41b4-9c67-987653208085.wav','/uploads/covers/seed-9-132-227-116-185-255.png',1,'Artist-uploaded',NULL,'2026-09-06 03:55:52','2026-09-06 03:55:52'),(13,'Deep Blue',5,5,6,'Instrumental',210,0,'2024-01-01',5600,'/uploads/music/c0f30344-3de0-43d0-866f-0b0ac01c966e.wav','/uploads/covers/seed-0-184-148-85-239-196.png',0,'Artist-uploaded',NULL,'2026-09-06 03:55:52','2026-09-06 03:55:52'),(14,'Coral Theory',5,5,7,'Instrumental',260,0,'2024-01-01',2804,'/uploads/music/8bb6a8a2-a8e1-4bde-9c84-d4fea8dfe198.wav','/uploads/covers/seed-214-48-49-255-118-117.png',0,'Artist-uploaded',NULL,'2026-09-06 03:55:52','2026-09-06 03:55:52'),(15,'City of Fog',6,6,8,'English',230,0,'2023-01-01',4653,'/uploads/music/9b604e8e-af49-41ee-9757-09c2d16682be.wav','/uploads/covers/seed-108-92-231-162-155-254.png',0,'Artist-uploaded',NULL,'2026-09-06 03:55:53','2026-09-06 03:55:53'),(16,'Station Lights',6,6,8,'English',215,0,'2023-01-01',6609,'/uploads/music/7bf78d22-26d6-465c-a17f-e3561c2a11f6.wav','/uploads/covers/seed-78-205-196-168-230-207.png',0,'Artist-uploaded',NULL,'2026-09-06 03:55:53','2026-09-06 03:55:53'),(17,'Gravity',7,7,3,'Hindi',250,0,'2025-01-01',3488,'/uploads/music/486bf750-0222-412c-9295-01cf71f5309a.wav','/uploads/covers/seed-179-55-113-232-160-191.png',0,'Artist-uploaded',NULL,'2026-09-06 03:55:53','2026-09-06 03:55:53'),(18,'Safed Raatein',7,7,9,'Hindi',235,0,'2025-01-01',7271,'/uploads/music/28dab461-a131-4148-8962-318f30e98349.wav','/uploads/covers/seed-45-52-54-99-110-114.png',1,'Artist-uploaded',NULL,'2026-09-06 03:55:53','2026-09-06 04:14:00'),(19,'Timro Awaaz',8,8,3,'Nepali',245,0,'2025-01-01',9218,'/uploads/music/09b9588d-8b84-4e94-8fc4-65261e37691d.wav','/uploads/covers/seed-26-26-46-45-52-54.png',1,'Artist-uploaded',NULL,'2026-09-06 03:55:53','2026-09-06 04:13:58'),(20,'Naya Din',8,8,5,'Nepali',200,0,'2025-01-01',5656,'/uploads/music/2ead7a9d-743d-4bba-8e19-1025aff125b0.wav','/uploads/covers/seed-255-71-87-255-160-122.png',0,'Artist-uploaded',NULL,'2026-09-06 03:55:53','2026-09-06 03:55:53'),(21,'City Lights',9,9,10,'Instrumental',300,0,'2024-01-01',3620,'/uploads/music/52ae540b-36ff-46d6-ab08-60ce4347a916.wav','/uploads/covers/seed-72-202-228-240-231-51.png',0,'Artist-uploaded',NULL,'2026-09-06 03:55:54','2026-09-06 03:55:54'),(22,'Night Shift',9,9,2,'Instrumental',285,0,'2024-01-01',1333,'/uploads/music/43e7f665-707a-4d61-a8c4-9b429ea9976a.wav','/uploads/covers/seed-17-153-142-56-239-125.png',0,'Artist-uploaded',NULL,'2026-09-06 03:55:54','2026-09-06 03:55:54'),(23,'Yatra',10,10,11,'Nepali',330,0,'2023-01-01',8534,'/uploads/music/ebf5dc90-2255-4a48-ad22-fb5fa089339a.wav','/uploads/covers/seed-84-160-255-95-39-205.png',0,'Artist-uploaded',NULL,'2026-09-06 03:55:54','2026-09-06 04:14:04'),(24,'Udaan',10,10,3,'Nepali',270,0,'2023-01-01',2650,'/uploads/music/034caa10-fc31-4259-9983-f876d68ba32a.wav','/uploads/covers/seed-255-214-10-245-87-108.png',1,'Artist-uploaded',NULL,'2026-09-06 03:55:54','2026-09-06 04:12:27');
/*!40000 ALTER TABLE `songs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `name` varchar(120) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` enum('user','artist','admin') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'user',
  `bio` text COLLATE utf8mb4_unicode_ci,
  `avatar` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'tester-000655@test.dev','Tester','$2b$10$WcAG7NreKxYKMfkI4yVQse1qwB0PZFAOcyR.7xOjTyinUZGWGtvR6','admin',NULL,NULL,'2026-09-06 03:55:45','2026-09-06 03:55:45'),(2,'pratyushmaharjan90@gmail.com','Pratyush Maharjan','$2b$10$Eo/.zhLXzdq8LRMWqXmT1OPz9/mK/mkP7AkJ7N8ewqRNLV78.tQ4O','admin',NULL,NULL,'2026-09-06 03:55:46','2026-09-06 03:55:46');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'beatnest'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-09-06  4:24:34
