using Microsoft.EntityFrameworkCore;
using TaskManager.Data;

var builder = WebApplication.CreateBuilder(args);

// Додаємо сервіси
builder.Services.AddControllers()
    .AddNewtonsoftJson(options =>
    {
        options.SerializerSettings.ReferenceLoopHandling = Newtonsoft.Json.ReferenceLoopHandling.Ignore;
        options.SerializerSettings.ContractResolver = new Newtonsoft.Json.Serialization.DefaultContractResolver
        {
            NamingStrategy = null // Зберігаємо оригінальний регістр (Name замість name)
        };
    });

builder.Services.AddDbContext<TaskManagerContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

var app = builder.Build();

// Конфігурація конвеєру
if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}
else
{
    app.UseExceptionHandler("/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();

// Додаємо підтримку статичних файлів (wwwroot)
app.UseStaticFiles();

// Налаштування маршруту за замовчуванням для SPA
app.UseRouting();
app.UseAuthorization();
app.MapControllers();

// Повертаємо index.html для всіх не-API запитів
app.MapFallbackToFile("index.html");

app.Run();
