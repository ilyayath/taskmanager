using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using System.ComponentModel.DataAnnotations;
using TaskManager.Models;

namespace TaskManager.Data
{
    public class TaskManagerContext : IdentityDbContext<User, IdentityRole<int>, int>
    {
        public DbSet<TaskItem> Tasks { get; set; }
        public DbSet<Category> Categories { get; set; }
        public DbSet<Tag> Tags { get; set; }
        public DbSet<TaskTag> TaskTags { get; set; }
        public DbSet<Comment> Comments { get; set; } // Додано
        public DbSet<Note> Notes { get; set; } // Додано

        public TaskManagerContext(DbContextOptions<TaskManagerContext> options)
            : base(options)
        {
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Налаштування зв’язку між TaskItem і User
            modelBuilder.Entity<TaskItem>()
                .HasOne(t => t.AssignedUser)
                .WithMany(u => u.Tasks)
                .HasForeignKey(t => t.UserId)
                .OnDelete(DeleteBehavior.Restrict)
                .IsRequired(false);

            // Налаштування зв’язку між TaskItem і Category
            modelBuilder.Entity<TaskItem>()
                .HasOne(t => t.Category)
                .WithMany(c => c.Tasks)
                .HasForeignKey(t => t.CategoryId)
                .OnDelete(DeleteBehavior.Restrict)
                .IsRequired(false);

            // Налаштування зв’язку багато-до-багатьох між TaskItem і Tag через TaskTag
            modelBuilder.Entity<TaskTag>()
                .HasKey(tt => new { tt.TaskId, tt.TagId });

            modelBuilder.Entity<TaskTag>()
                .HasOne(tt => tt.Task)
                .WithMany(t => t.TaskTags)
                .HasForeignKey(tt => tt.TaskId);

            modelBuilder.Entity<TaskTag>()
                .HasOne(tt => tt.Tag)
                .WithMany(t => t.TaskTags)
                .HasForeignKey(tt => tt.TagId);

            // Налаштування зв’язку між Comment і Task
            modelBuilder.Entity<Comment>()
                .HasOne(c => c.Task)
                .WithMany(t => t.Comments)
                .HasForeignKey(c => c.TaskId)
                .OnDelete(DeleteBehavior.Cascade);

            modelBuilder.Entity<Comment>()
                .HasOne(c => c.User)
                .WithMany()
                .HasForeignKey(c => c.UserId)
                .OnDelete(DeleteBehavior.Restrict);

            // Налаштування зв’язку між Note і Task
            modelBuilder.Entity<Note>()
                .HasOne(n => n.Task)
                .WithMany(t => t.NotesList)
                .HasForeignKey(n => n.TaskId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }

    public class Tag
    {
        public int Id { get; set; }

        [Required]
        [StringLength(50)]
        public string Name { get; set; }

        public ICollection<TaskTag> TaskTags { get; set; } = new List<TaskTag>();
    }

    public class TaskTag
    {
        public int TaskId { get; set; }
        public TaskItem Task { get; set; }
        public int TagId { get; set; }
        public Tag Tag { get; set; }
    }

    // DTO для Tag
    public class TagDto
    {
        public int id { get; set; }
        public string name { get; set; }
    }
}