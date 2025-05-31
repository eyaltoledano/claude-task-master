class TaskMaster < Formula
    desc "Task management system for AI-driven development"
    homepage "https://github.com/eyaltoledano/claude-task-master"
    url "https://registry.npmjs.org/task-master-ai/-/task-master-ai-0.15.0.tgz"
    sha256 "8b544fbda85f831a112b52ab3076a4a40f9f574196c8166e2de89fbebde91b43"
    license "MIT"
  
    depends_on "node"
  
    def install
      system "npm", "install", *std_npm_args
      bin.install_symlink libexec/"bin/task-master" => "task-master"
      bin.install_symlink libexec/"bin/task-master-mcp"
    end
  
    test do
      system bin/"task-master", "--version"
      assert_match "0.15.0", shell_output("#{bin}/task-master --version")
    end
  end
  