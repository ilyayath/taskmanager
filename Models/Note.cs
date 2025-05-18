using System;
using System.ComponentModel.DataAnnotations;
using TaskManager.Models;

namespace TaskManager.Models
{
    public class Note
    {
        public int Id { get; set; }

        [Required]
        public int TaskId { get; set; }
        public TaskItem Task { get; set; }

        [Required]
        [StringLength(100)]
        public string Title { get; set; }

        [Required]
        [StringLength(1000)]
        public string Content { get; set; }

        [Required]
        public DateTime CreatedAt { get; set; }

        [Required]
        public DateTime UpdatedAt { get; set; }
    }

    // DTO для Note
    public class NoteDto
    {
        public int id { get; set; }
        public int taskId { get; set; }
        public string title { get; set; }
        public string content { get; set; }
        public DateTime createdAt { get; set; }
        public DateTime updatedAt { get; set; }
    }
}