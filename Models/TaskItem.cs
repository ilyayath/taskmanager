using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using System.Text.Json.Serialization;

namespace TaskManager.Models
{
    public class TaskItem
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public string Title { get; set; }

        // Видаляємо [Required], якщо Description не обов’язковий
        public string Description { get; set; }

        public int? UserId { get; set; } // Nullable зовнішній ключ

        [NotMapped]
        [BindNever]
        public User? AssignedUser { get; set; }

        [Required]
        public DateTime DueDate { get; set; }

        public bool IsCompleted { get; set; }
    }

    public class User
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public string Name { get; set; }

        [JsonIgnore]
        public ICollection<TaskItem> Tasks { get; set; } = new List<TaskItem>();
    }
}