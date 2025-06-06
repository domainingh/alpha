<?php
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *"); // Allow requests from any origin (for development)

$videos = [
    ["id" => 1, "title" => "Introduction to Programming", "url" => "http://example.com/video1.mp4"],
    ["id" => 2, "title" => "Data Structures", "url" => "http://example.com/video2.mp4"],
    ["id" => 3, "title" => "Algorithms", "url" => "http://example.com/video3.mp4"]
];

echo json_encode($videos);
?>
