using System;
using System.ComponentModel.DataAnnotations;
using TaskManager.Models;

namespace TaskManager.Models
{
    public class Comment
    {
        public int Id { get; set; }

        [Required]
        public int TaskId { get; set; }
        public TaskItem Task { get; set; }

        [Required]
        public int UserId { get; set; }
        public User User { get; set; }

        [Required]
        [StringLength(500)]
        public string Content { get; set; }

        [Required]
        public DateTime CreatedAt { get; set; }
    }

    // DTO для Comment
    public class CommentDto
    {
        public int id { get; set; }
        public int taskId { get; set; }
        public int userId { get; set; }
        public string comment { get; set; } // Відповідає фронтенду
        public DateTime timestamp { get; set; } // Відповідає фронтенду
    }
}