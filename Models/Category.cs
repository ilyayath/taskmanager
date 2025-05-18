using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;

namespace TaskManager.Models
{
    public class Category
    {
        public int Id { get; set; }

        [Required]
        [StringLength(50)]
        public string Name { get; set; }

        public List<TaskItem> Tasks { get; set; } = new List<TaskItem>(); // Ініціалізація списку
    }

    // DTO для Category
    public class CategoryDto
    {
        public int id { get; set; }
        public string name { get; set; }
    }
}