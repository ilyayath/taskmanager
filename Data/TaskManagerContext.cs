using Microsoft.EntityFrameworkCore;
using TaskManager.Models;

namespace TaskManager.Data
{
    public class TaskManagerContext : DbContext
    {
        public DbSet<TaskItem> Tasks { get; set; }
        public DbSet<User> Users { get; set; }

        public TaskManagerContext(DbContextOptions<TaskManagerContext> options)
            : base(options)
        {
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<TaskItem>()
                .HasOne(t => t.AssignedUser)
                .WithMany(u => u.Tasks)
                .HasForeignKey(t => t.UserId)
                .IsRequired(false); // Дозволяємо AssignedUser бути необов'язковим
        }
    }
}