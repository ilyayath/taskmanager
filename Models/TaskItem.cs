using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using System.Text.Json.Serialization;
using TaskManager.Data;

namespace TaskManager.Models
{
    public class TaskItem
    {
        public int Id { get; set; }

        [Required]
        public string Title { get; set; }

        public string Description { get; set; }

        [Required]
        public DateTime DueDate { get; set; }

        public bool IsCompleted { get; set; }

        public int? UserId { get; set; }
        public User AssignedUser { get; set; }

        public int? CategoryId { get; set; }
        public Category Category { get; set; }

        public string Notes { get; set; }

        // Нове поле для прогресу (0-100%)
        public int Progress { get; set; } = 0;

        // Зв’язок з тегами
        public ICollection<TaskTag> TaskTags { get; set; }
    }



    public class User : IdentityUser<int>
    {
        [Required]
        public string Name { get; set; }

        [NotMapped]
        [JsonIgnore]
        public virtual ICollection<TaskItem> Tasks { get; set; } = new List<TaskItem>();
    }

    public class UserDto
    {
        public int Id { get; set; }

        [Required]
        public string Name { get; set; }

        [Required]
        public string Email { get; set; }
    }
}