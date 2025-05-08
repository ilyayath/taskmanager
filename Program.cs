using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Serilog;
using TaskManager.Data;
using TaskManager.Models;

var builder = WebApplication.CreateBuilder(args);

Log.Logger = new LoggerConfiguration()
    .WriteTo.Console()
    .WriteTo.File("logs/log-.txt", rollingInterval: RollingInterval.Day)
    .CreateLogger();

builder.Host.UseSerilog();

builder.Services.AddControllers()
    .AddNewtonsoftJson(options =>
    {
        options.SerializerSettings.ReferenceLoopHandling = Newtonsoft.Json.ReferenceLoopHandling.Ignore;
        options.SerializerSettings.ContractResolver = new Newtonsoft.Json.Serialization.DefaultContractResolver();
    });

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowSpecificOrigin", policy =>
    {
        policy.WithOrigins("https://localhost:7285")
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

builder.Services.AddDbContext<TaskManagerContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

builder.Services.AddIdentity<User, IdentityRole<int>>()
    .AddEntityFrameworkStores<TaskManagerContext>()
    .AddDefaultTokenProviders();

builder.Services.Configure<IdentityOptions>(options =>
{
    options.Password.RequireDigit = false;
    options.Password.RequireLowercase = false;
    options.Password.RequireNonAlphanumeric = false;
    options.Password.RequireUppercase = false;
    options.Password.RequiredLength = 6;
});

builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.LoginPath = "/api/account/login";
        options.AccessDeniedPath = "/api/account/accessdenied";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
    });

builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "X-CSRF-TOKEN";
    options.Cookie.Name = "XSRF-TOKEN";
    options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
    options.Cookie.SameSite = SameSiteMode.Lax;
});

var app = builder.Build();

app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        var errorFeature = context.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>();
        if (errorFeature != null)
        {
            Log.Error(errorFeature.Error, "Unhandled exception occurred");
            context.Response.StatusCode = 500;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsJsonAsync(new
            {
                error = "An unexpected error occurred.",
                details = app.Environment.IsDevelopment() ? errorFeature.Error.Message : null
            });
        }
    });
});

if (app.Environment.IsDevelopment())
{
    app.UseDeveloperExceptionPage();
}
else
{
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseCors("AllowSpecificOrigin");
app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();
app.UseAntiforgery();

app.UseEndpoints(endpoints =>
{
    endpoints.MapControllers();
    endpoints.MapGet("/debug/routes", async context =>
    {
        var routeData = endpoints.DataSources.First().Endpoints
            .Select(e => e.DisplayName)
            .OrderBy(e => e);
        await context.Response.WriteAsJsonAsync(new { routes = routeData });
    });
});

app.MapFallbackToFile("index.html");

// Ініціалізація ролей, тестових даних та тегів
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    var roleManager = services.GetRequiredService<RoleManager<IdentityRole<int>>>();
    var userManager = services.GetRequiredService<UserManager<User>>();
    var context = services.GetRequiredService<TaskManagerContext>();

    string[] roleNames = { "Manager", "Worker" };
    foreach (var roleName in roleNames)
    {
        if (!await roleManager.RoleExistsAsync(roleName))
        {
            await roleManager.CreateAsync(new IdentityRole<int>(roleName));
        }
    }

    var testUserEmail = "test@example.com";
    var testUser = await userManager.FindByEmailAsync(testUserEmail);
    if (testUser == null)
    {
        testUser = new User { UserName = testUserEmail, Email = testUserEmail, Name = "Test User" };
        await userManager.CreateAsync(testUser, "Test@123");
        await userManager.AddToRoleAsync(testUser, "Manager");
    }

    if (!context.Categories.Any())
    {
        context.Categories.AddRange(
            new Category { Name = "General" },
            new Category { Name = "Urgent" }
        );
        await context.SaveChangesAsync();
    }

    if (!context.Tasks.Any())
    {
        var category = await context.Categories.FirstAsync(c => c.Name == "General");
        context.Tasks.AddRange(
            new TaskItem
            {
                Title = "Test Task 1",
                Description = "This is a test task",
                DueDate = DateTime.UtcNow.AddDays(1),
                IsCompleted = false,
                UserId = testUser.Id,
                CategoryId = category.Id,
                Notes = "",
                Progress = 0,
                TaskTags = new List<TaskTag>()
            }
        );
        await context.SaveChangesAsync();
    }

    if (!context.Tags.Any())
    {
        context.Tags.AddRange(
            new Tag { Name = "Meeting" },
            new Tag { Name = "Urgent" },
            new Tag { Name = "Personal" }
        );
        await context.SaveChangesAsync();
    }
}

app.Run();