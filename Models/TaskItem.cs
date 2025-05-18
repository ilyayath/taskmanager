using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Identity;
using TaskManager.Data;

namespace TaskManager.Models
{
    public class TaskItem
    {
        public int Id { get; set; }

        [Required]
        [StringLength(100)]
        public string Title { get; set; }

        [StringLength(500)]
        public string? Description { get; set; } // Видалено [Required(false)], nullable тип достатній

        [Required]
        public DateTime DueDate { get; set; }

        public bool IsCompleted { get; set; }

        public int? UserId { get; set; }
        public User? AssignedUser { get; set; }

        public int? CategoryId { get; set; }
        public Category? Category { get; set; }

        [Required]
        [StringLength(10)]
        public string Priority { get; set; } // High, Medium, Low

        public int Progress { get; set; }

        [StringLength(1000)]
        public string? Notes { get; set; } // Видалено [Required(false)], nullable тип достатній

        public List<TaskTag> TaskTags { get; set; } = new List<TaskTag>();
        public List<Comment> Comments { get; set; } = new List<Comment>();
        public List<Note> NotesList { get; set; } = new List<Note>();
    }

    public class TaskItemDto
    {
        public int id { get; set; }
        public string title { get; set; }
        public string? description { get; set; }
        public DateTime dueDate { get; set; }
        public bool isCompleted { get; set; }
        public int? userId { get; set; }
        public int? categoryId { get; set; }
        public string priority { get; set; }
        public int progress { get; set; }
        public string? notes { get; set; }
        public List<int> tagIds { get; set; } = new List<int>();
    }

    public class User : IdentityUser<int>
    {
        [Required]
        [StringLength(50)]
        public string Name { get; set; }

        [NotMapped]
        [JsonIgnore]
        public virtual ICollection<TaskItem> Tasks { get; set; } = new List<TaskItem>();
    }

    public class UserDto
    {
        public int Id { get; set; }
        [Required]
        [StringLength(50)]
        public string Name { get; set; }
        [Required]
        [EmailAddress]
        public string Email { get; set; }
    }

    // DTO для пагінації задач
    public class PagedTasksResponse
    {
        public List<TaskItemDto> tasks { get; set; } = new List<TaskItemDto>();
        public int total { get; set; }
        public int page { get; set; }
    }
}