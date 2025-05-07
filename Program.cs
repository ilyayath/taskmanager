using Microsoft.EntityFrameworkCore;
using TaskManager.Data;

var builder = WebApplication.CreateBuilder(args);

// ������ ������
builder.Services.AddControllers()
    .AddNewtonsoftJson(options =>
    {
        options.SerializerSettings.ReferenceLoopHandling = Newtonsoft.Json.ReferenceLoopHandling.Ignore;
        options.SerializerSettings.ContractResolver = new Newtonsoft.Json.Serialization.DefaultContractResolver
        {
            NamingStrategy = null // �������� ����������� ������ (Name ������ name)
        };
    });

builder.Services.AddDbContext<TaskManagerContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

var app = builder.Build();

// ������������ �������
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

// ������ �������� ��������� ����� (wwwroot)
app.UseStaticFiles();

// ������������ �������� �� ������������� ��� SPA
app.UseRouting();
app.UseAuthorization();
app.MapControllers();

// ��������� index.html ��� ��� ��-API ������
app.MapFallbackToFile("index.html");

app.Run();
