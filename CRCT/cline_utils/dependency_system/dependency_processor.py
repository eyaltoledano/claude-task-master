import argparse
import re
import os
import io
import json
import struct
import sys
from collections import defaultdict
from typing import Dict, List, Tuple, Optional

from sentence_transformers import SentenceTransformer

# Constants for readability
ASCII_A = 65  # ASCII value for 'A'


def generate_keys(root_paths: List[str]) -> Tuple[Dict[str, str], bool]:
    """Generate hierarchical keys."""
    if isinstance(root_paths, str):
        root_paths = [root_paths]

    for root_path in root_paths:
        if not os.path.exists(root_path):
            raise FileNotFoundError(f"Root path '{root_path}' does not exist.")

    dir_to_letter: Dict[str, str] = {}
    key_map: Dict[str, str] = {}
    new_keys_added = False  # Track if new keys are added

    def process_directory(dir_path: str, parent_key: str = None, tier: int = 1):
        """Recursively processes directories and files."""
        nonlocal dir_to_letter, key_map, new_keys_added

        if parent_key is None:  # Top-level directory
            dir_letter = chr(ASCII_A + len(dir_to_letter))
            norm_dir_path = os.path.normpath(dir_path)
            dir_to_letter[norm_dir_path] = dir_letter
            key = f"{tier}{dir_letter}"
            if key not in key_map:
                key_map[key] = norm_dir_path.replace("\\", "/")
                new_keys_added = True
        else:
            key = parent_key

        try:
            items = sorted(os.listdir(dir_path))
        except OSError as e:
            print(f"Error accessing directory '{dir_path}': {e}")
            return

        file_count = 1
        subdir_count = 1

        for item_name in items:
            item_path = os.path.join(dir_path, item_name)
            norm_item_path = os.path.normpath(item_path).replace("\\", "/")

            if item_name in ("__pycache__", ".gitkeep"):
                continue

            if os.path.isfile(item_path):
                file_key = f"{key}{file_count}"
                if file_key not in key_map:
                    key_map[file_key] = norm_item_path
                    new_keys_added = True
                file_count += 1
            elif os.path.isdir(item_path):
                subdir_letter = chr(97 + subdir_count - 1)
                subdir_key = f"{tier + 1}{key[1:]}{subdir_letter}"
                if subdir_key not in key_map:
                    key_map[subdir_key] = norm_item_path
                    new_keys_added = True
                subdir_count += 1
                process_directory(item_path, subdir_key, tier + 1)

    for root_path in root_paths:
        process_directory(root_path)
    return key_map, new_keys_added


def _parse_count(s: str, start: int) -> Tuple[int, int]:
    """Helper function to parse the count from a string."""
    j = start
    while j < len(s) and s[j].isdigit():
        j += 1
    return int(s[start:j]), j


def compress(s: str) -> str:
    """Compress a dependency string (RLE, excluding 'o')."""
    return re.sub(
        r'([^o])\1{2,}',
        lambda m: m.group(1) + str(len(m.group())),
        s
    )


def decompress(s: str) -> str:
    """Decompress a compressed dependency string."""
    result = ''
    i = 0
    while i < len(s):
        if i + 1 < len(s) and s[i+1].isdigit():
            char = s[i]
            count, i = _parse_count(s, i + 1)
            result += char * count
        else:
            result += s[i]
            i += 1
    return result


def get_char_at(s: str, index: int) -> str:
    """Get the character at a specific index in the decompressed string."""
    decompressed_index = 0
    i = 0
    while i < len(s):
        if i + 1 < len(s) and s[i+1].isdigit():
            char = s[i]
            count, i = _parse_count(s, i + 1)
            if decompressed_index + count > index:
                return char
            decompressed_index += count
        else:
            if decompressed_index == index:
                return s[i]
            decompressed_index += 1
            i += 1
    raise IndexError("Index out of range")


def set_char_at(s: str, index: int, new_char: str) -> str:
    """Set a character at a specific index and return the compressed string."""
    if not isinstance(new_char, str) or len(new_char) != 1:
        raise ValueError("new_char must be a single character string")

    decompressed = decompress(s)
    if index >= len(decompressed):
        raise IndexError("Index out of range")
    decompressed = decompressed[:index] + new_char + decompressed[index+1:]
    return compress(decompressed)


def _read_existing_keys(lines: List[str]) -> Dict[str, str]:
    """Reads existing key definitions from the tracker file content."""
    key_def_start = "---KEY_DEFINITIONS_START---"
    key_def_end = "---KEY_DEFINITIONS_END---"
    try:
        start = lines.index(key_def_start + "\n") + 2
        end = lines.index(key_def_end + "\n")
        return {
            k: v
            for line in lines[start:end]
            if ": " in line
            for k, v in [line.strip().split(": ", 1)]
        }
    except ValueError:
        return {}


def _read_existing_grid(lines: List[str]) -> Dict[str, str]:
    """Reads the existing grid data from the tracker file content."""
    grid_start = "---GRID_START---"
    grid_end = "---GRID_END---"
    try:
        start = lines.index(grid_start + "\n") + 1
        end = lines.index(grid_end + "\n")
        return {
            match.group(1): match.group(2)
            for line in lines[start:end]
            if (match := re.match(r"(\w+) = (.*)", line))
        }
    except ValueError:
        return {}


def _write_key_definitions(file_obj: io.StringIO, key_map: Dict[str, str], sort_keys: bool = True):
    """Writes the key definitions section to the file object."""
    key_def_start = "---KEY_DEFINITIONS_START---"
    key_def_end = "---KEY_DEFINITIONS_END---"
    file_obj.write(f"{key_def_start}\nKey Definitions:\n")
    if sort_keys:
        def sort_key(key):
            parts = re.findall(r'\d+|\D+', key)
            return [int(p) if p.isdigit() else p for p in parts]
        for k, v in sorted(key_map.items(), key=lambda item: sort_key(item[0])):
            file_obj.write(f"{k}: {v}\n")
    else:
        for k, v in key_map.items():
            file_obj.write(f"{k}: {v}\n")
    file_obj.write(f"{key_def_end}\n")


def _write_grid(file_obj: io.StringIO, sorted_keys: List[str], existing_grid: Dict[str, str]):
    """Writes the grid section to the provided file object."""
    grid_start = "---GRID_START---"
    grid_end = "---GRID_END---"

    file_obj.write(f"{grid_start}\n")
    file_obj.write(f"X {' '.join(sorted_keys)}\n")

    for row_key in sorted_keys:
        row = ["o" if row_key == col_key else "p" for col_key in sorted_keys]
        initial_string = compress(''.join(row))
        file_obj.write(f"{row_key} = {existing_grid.get(row_key, initial_string)}\n")

    file_obj.write(f"{grid_end}\n")


def extract_imports(file_path: str) -> List[str]:
    """
    Extract import statements from a Python file.
    Handles simple, from ... import, relative, and aliased imports.
    Returns a list of normalized, absolute import paths (relative to project root).
    """
    imports = []
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            for line in f:
                match = re.match(r"^\s*from\s+([\w\.]+)\s+import\s+(.+)", line)
                if match:
                    base_module = match.group(1)
                    imported_items = match.group(2)
                    if imported_items.strip() == "*":
                        imports.append(base_module)
                    else:
                        for item in imported_items.split(","):
                            item = item.strip()
                            alias_match = re.match(r"([\w\.]+)\s+as\s+\w+", item)
                            if alias_match:
                                item = alias_match.group(1)
                            imports.append(f"{base_module}.{item.split(' as ')[0].strip()}")
                else:
                    match = re.match(r"^\s*import\s+(.+)", line)
                    if match:
                        for item in match.group(1).split(","):
                            item = item.strip()
                            alias_match = re.match(r"([\w\.]+)\s+as\s+\w+", item)
                            if alias_match:
                                item = alias_match.group(1)
                            imports.append(item.split(" as ")[0].strip())
    except UnicodeDecodeError:
        print(f"Warning: Could not decode file {file_path} as UTF-8. Skipping.")
        return []
    except OSError as e:
        print(f"Error reading file {file_path}: {e}")
        return []

    resolved_imports = []
    for imp in imports:
        if imp.startswith("."):
            parts = imp.split(".")
            num_dots = len(parts) - len([p for p in parts if p])
            current_dir = os.path.dirname(file_path)
            for _ in range(num_dots - 1):
                current_dir = os.path.dirname(current_dir)
            resolved_path = os.path.normpath(os.path.join(current_dir, *parts[num_dots:])).replace("\\", "/")
            resolved_imports.append(resolved_path)
        else:
            resolved_imports.append(imp)
    return resolved_imports


def find_explicit_references(file_path: str, doc_dir: str) -> List[str]:
    """Find explicit references to other documentation files."""
    references = []
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
            norm_doc_dir = os.path.normpath(doc_dir)
            for match in re.findall(rf'(?:See|refer to)\s+({re.escape(norm_doc_dir)}/[\w\./-]+\.md)', content, re.IGNORECASE):
                references.append(os.path.normpath(match).replace("\\", "/"))
    except UnicodeDecodeError:
        print(f"Warning: Could not decode file {file_path} as UTF-8. Skipping reference extraction.")
        return []
    except OSError as e:
        print(f"Error reading file {file_path}: {e}")
        return []

    return references


def _load_embedding(embedding_path: str) -> Optional[List[float]]:
    """Loads an embedding from a .embedding file."""
    try:
        with open(embedding_path, "rb") as f:
            embedding = list(struct.unpack("<" + "f" * (os.path.getsize(embedding_path) // 4), f.read()))
            return embedding
    except FileNotFoundError:
        print(f"Embedding file not found: {embedding_path}")
        return None
    except OSError as e:
        print(f"Error loading embedding from {embedding_path}: {e}")
        return None


def calculate_similarity(key1: str, key2: str, embeddings_dir: str) -> float:
    """Calculates cosine similarity between two embeddings."""
    embedding1 = _load_embedding(os.path.join(embeddings_dir, f"{key1}.embedding"))
    embedding2 = _load_embedding(os.path.join(embeddings_dir, f"{key2}.embedding"))

    if embedding1 is None or embedding2 is None:
        return 0.0

    dot_product = sum(a * b for a, b in zip(embedding1, embedding2))
    magnitude1 = sum(a * a for a in embedding1) ** 0.5
    magnitude2 = sum(b * b for b in embedding2) ** 0.5

    if magnitude1 == 0 or magnitude2 == 0:
        return 0.0
    return dot_product / (magnitude1 * magnitude2)


def generate_embeddings(root_paths: List[str], output_dir: str, model_name: str = "all-mpnet-base-v2"):
    """Generates embeddings for files and saves them, along with metadata, in output_dir/embeddings/."""
    if isinstance(root_paths, str):
        root_paths = [root_paths]

    embeddings_dir = os.path.join(output_dir, "embeddings")  # Define embeddings subdirectory
    os.makedirs(embeddings_dir, exist_ok=True)  # Create embeddings dir
    metadata_file = os.path.join(embeddings_dir, "metadata.json")  # Metadata in embeddings dir
    metadata = {}
    file_count = 0

    # Define exclusions
    EXCLUDED_DIRS = {".venv", ".git", "__pycache__"}
    EXCLUDED_EXTS = {".sqlite3", ".bin", ".pyc", ".pyo", ".pyd"}

    if os.path.exists(metadata_file):
        try:
            with open(metadata_file, "r", encoding="utf-8") as f:
                metadata = json.load(f)
        except (OSError, json.JSONDecodeError) as e:
            print(f"Warning: Could not read metadata file: {e}. Starting fresh.")
            metadata = {}

    try:
        model = SentenceTransformer(model_name)
    except ImportError as e:
        print(f"Error: Could not load Sentence Transformer model '{model_name}'. Ensure it's installed: {e}")
        sys.exit(1)

    key_map = generate_keys(root_paths)[0]

    for key, path in key_map.items():
        if not os.path.isfile(path):
            continue
        # Skip excluded directories and file types
        if any(excluded in path for excluded in EXCLUDED_DIRS) or os.path.splitext(path)[1] in EXCLUDED_EXTS:
            continue
        try:
            with open(path, "r", encoding="utf-8") as f:
                content = f.read()
        except UnicodeDecodeError:
            print(f"Warning: Could not decode file {path} with UTF-8. Skipping embedding.")
            continue
        except OSError as e:
            print(f"Error reading file {path}: {e}")
            continue

        try:
            embedding = model.encode(content).tolist()
            embedding_file = os.path.join(embeddings_dir, f"{key}.embedding")
            with open(embedding_file, "wb") as f:
                f.write(struct.pack("<" + "f" * len(embedding), *embedding))
            metadata[key] = {
                "path": path,
                "embedding_file": os.path.basename(embedding_file),
                "text": content[:200] + "..." if len(content) > 200 else content,
            }
            file_count += 1
            print(f"Processed file: {file_count} / {len(key_map)}", end='\r')
        except OSError as e:
            print(f"Error processing file {path}: {e}")
            continue

    print(f"\nEmbeddings and metadata saved to {embeddings_dir}")
    with open(metadata_file, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=4)


def suggest_dependencies(tracker_file: str, tracker_type: str, key_map: Dict[str, str]) -> Dict[str, List[Tuple[str, str]]]:
    """Suggest dependencies based on tracker type and file content."""
    suggestions: Dict[str, List[Tuple[str, str]]] = defaultdict(list)
    embeddings_dir = os.path.join(os.path.dirname(tracker_file), "embeddings")
    metadata_path = os.path.join(embeddings_dir, "metadata.json")

    if tracker_type == "main":
        for key, path in key_map.items():
            if key[0] == '2' and os.path.isfile(path):  # Subdirectory-level files only
                imported_modules = extract_imports(path)
                for imported_module in imported_modules:
                    for other_key, other_path in key_map.items():
                        if other_path.startswith(imported_module) and len(other_key) == 2 and key != other_key:
                            suggestions[key].append((other_key, '<'))
                            suggestions[other_key].append((key, '>'))
    elif tracker_type == "doc":
        if not os.path.exists(metadata_path):
            print(f"Error: Metadata file '{metadata_path}' not found. Run 'generate-embeddings' first.")
            sys.exit(1)
        try:
            with open(metadata_path, "r", encoding="utf-8") as f:
                metadata = json.load(f)
        except (OSError, json.JSONDecodeError) as e:
            print(f"Error reading metadata file '{metadata_path}': {e}")
            sys.exit(1)

        for key, data in metadata.items():
            for ref_path in find_explicit_references(data['path'], os.path.dirname(tracker_file)):
                for other_key, other_path in key_map.items():
                    if os.path.normpath(other_path).replace("\\", "/") == ref_path:
                        suggestions[key].append((other_key, 'd'))
                        break

            for other_key in metadata:
                if key != other_key:
                    similarity = calculate_similarity(key, other_key, embeddings_dir)
                    print(f"Similarity between {key} and {other_key}: {similarity}")
                    if similarity > 0.65:
                        suggestions[key].append((other_key, 'x'))
    elif tracker_type == "mini":
        for key, path in key_map.items():
            if path.endswith(".py") and os.path.isfile(path):  # Only Python files
                imported_modules = extract_imports(path)
                for imported_module in imported_modules:
                    for other_key, other_path in key_map.items():
                        if other_path.startswith(imported_module) and key != other_key:
                            suggestions[key].append((other_key, '<'))
                            suggestions[other_key].append((key, '>'))
                    for other_key, other_path in key_map.items():
                        if other_path.startswith(os.path.normpath(os.path.join(os.path.dirname(tracker_file), "../docs")).replace("\\", "/")):
                            if imported_module in other_path:
                                suggestions[key].append((other_key, 'd'))

    return suggestions


def update_tracker(output_file: str, key_map: Dict[str, str], tracker_type: str = "mini", suggestions: Optional[Dict[str, List[Tuple[str, str]]]] = None, sort_keys: bool = True):
    """Updates or creates a tracker file."""
    def sort_key(key):
        parts = re.findall(r'\d+|\D+', key)
        return [int(p) if p.isdigit() else p for p in parts]

    if tracker_type == "main":
        filtered_keys = {
            k: v for k, v in key_map.items()
            if (k.startswith("1") and len(k) == 2) or
               (k[0] == '2' and len(k) > 2 and k[2].islower() and not any(char.isdigit() for char in k[2:]))
        }
    else:
        filtered_keys = key_map

    sorted_keys = sorted(filtered_keys.keys(), key=sort_key) if sort_keys else list(filtered_keys.keys())

    if not os.path.exists(output_file):
        with open(output_file, "w", encoding="utf-8") as f:
            _write_key_definitions(f, filtered_keys)
            f.write(f"last_KEY_edit: {sorted_keys[-1] if sorted_keys else ''}\n")
            f.write("last_GRID_edit: \n")
            _write_grid(f, sorted_keys, {})
    else:
        with open(output_file, "r", encoding="utf-8") as f:
            lines = f.readlines()

        existing_key_defs = _read_existing_keys(lines)
        existing_grid = _read_existing_grid(lines)
        last_key_edit_line = next((line for line in lines if line.startswith("last_KEY_edit")), None)
        last_grid_edit_line = next((line for line in lines if line.startswith("last_GRID_edit")), None)

        last_key_edit = last_key_edit_line.split(":", 1)[1].strip() if last_key_edit_line else ""
        last_grid_edit = last_grid_edit_line.split(":", 1)[1].strip() if last_grid_edit_line else ""

        merged_key_defs = existing_key_defs.copy()
        merged_key_defs.update(filtered_keys)
        sorted_merged_keys = sorted(merged_key_defs.keys(), key=sort_key) if sort_keys else list(merged_key_defs.keys())

        updated_content = io.StringIO()
        _write_key_definitions(updated_content, merged_key_defs)
        updated_content.write(f"last_KEY_edit: {last_key_edit}\n")
        updated_content.write(f"last_GRID_edit: {last_grid_edit}\n")
        _write_grid(updated_content, sorted_merged_keys, existing_grid)

        if suggestions:
            updated_grid = existing_grid.copy()
            for row_key, deps in suggestions.items():
                if row_key not in sorted_merged_keys:
                    print(f"Warning: Row key '{row_key}' not in tracker; skipping.")
                    continue
                current_row_str = updated_grid.get(row_key, compress(''.join(["o" if row_key == col_key else "p" for col_key in sorted_merged_keys])))
                decompressed = decompress(current_row_str)
                for col_key, dep_char in deps:
                    if col_key not in sorted_merged_keys:
                        print(f"Warning: Column key '{col_key}' not in tracker; skipping.")
                        continue
                    index = sorted_merged_keys.index(col_key)
                    if index >= len(decompressed):
                        print(f"Error: Index {index} out of bounds for row '{row_key}'; skipping.")
                        continue
                    if decompressed[index] == 'p':
                        decompressed = decompressed[:index] + dep_char + decompressed[index + 1:]
                    else:
                        print(f"Warning: Skipping update at index {index} for row '{row_key}'; already set to '{decompressed[index]}'.")
                updated_grid[row_key] = compress(decompressed)

            updated_content.seek(0)
            _write_key_definitions(updated_content, merged_key_defs)
            updated_content.write(f"last_KEY_edit: {last_key_edit}\n")
            updated_content.write(f"last_GRID_edit: {last_grid_edit}\n")
            _write_grid(updated_content, sorted_merged_keys, updated_grid)

        with open(output_file, "w", encoding="utf-8") as f:
            f.write(updated_content.getvalue())
        updated_content.close()


def remove_file_from_tracker(output_file: str, file_to_remove: str):
    """Removes a file's key and row/column from the tracker."""
    key_def_start = "---KEY_DEFINITIONS_START---"
    key_def_end = "---KEY_DEFINITIONS_END---"
    grid_start = "---GRID_START---"
    grid_end = "---GRID_END---"
    last_grid_edit = "last_GRID_edit"

    if not os.path.exists(output_file):
        raise FileNotFoundError(f"Tracker file '{output_file}' not found.")

    with open(output_file, "r", encoding="utf-8") as f:
        lines = f.readlines()

    try:
        key_def_start_index = lines.index(key_def_start + "\n") + 2
        key_def_end_index = lines.index(key_def_end + "\n")
        key_to_remove = next((k for line in lines[key_def_start_index:key_def_end_index]
                              if ": " in line
                              for k, v in [line.strip().split(": ", 1)]
                              if v == file_to_remove), None)
    except ValueError as e:
        raise ValueError("Key Definitions section not found.") from e

    if key_to_remove is None:
        raise ValueError(f"File '{file_to_remove}' not found in tracker.")

    updated_lines = [key_def_start + "\n", "Key Definitions:\n"]
    for line in lines[key_def_start_index:key_def_end_index]:
        if ": " in line and not line.startswith(key_to_remove + ":"):
            updated_lines.append(line)
    updated_lines.append(key_def_end + "\n")
    last_key_edit_line = next((line for line in lines if line.startswith("last_KEY_edit")), None)
    if last_key_edit_line:
        updated_lines.append(last_key_edit_line)
    updated_lines.append(f"{last_grid_edit}: {key_to_remove}\n")
    updated_lines.append(grid_start + "\n")

    try:
        grid_start_index = lines.index(grid_start + "\n") + 1
        grid_end_index = lines.index(grid_end + "\n")
        x_axis_line = lines[grid_start_index]
        x_axis_keys = x_axis_line.strip().split(" ", 1)[1].split()

        if key_to_remove not in x_axis_keys:
            raise ValueError(f"Key '{key_to_remove}' not found on X-axis.")

        updated_x_axis_keys = [k for k in x_axis_keys if k != key_to_remove]
        updated_lines.append(f"X {' '.join(updated_x_axis_keys)}\n")

        index_to_remove = x_axis_keys.index(key_to_remove)
        for line in lines[grid_start_index + 1:grid_end_index]:
            match = re.match(r"(\w+) = (.*)", line)
            if match and match.group(1) != key_to_remove:
                row_key = match.group(1)
                dependency_string = match.group(2)
                decompressed = decompress(dependency_string)
                updated_decompressed = (decompressed[:index_to_remove] +
                                        decompressed[index_to_remove + 1:])
                updated_lines.append(f"{row_key} = {compress(updated_decompressed)}\n")

    except ValueError as e:
        raise ValueError(f"Grid section error: {e}") from e

    updated_lines.append(grid_end + "\n")
    with open(output_file, "w", encoding="utf-8") as f:
        f.writelines(updated_lines)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Dependency Processor for CRCT System")
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    parser_keys = subparsers.add_parser("generate-keys", help="Generate keys and update tracker")
    parser_keys.add_argument("root_paths", type=str, nargs='+', help="Root directory paths")
    parser_keys.add_argument("--output", type=str, help="Output tracker file")
    parser_keys.add_argument("--tracker_type", type=str, default="mini", choices=["main", "doc", "mini"],
                             help="Type of tracker ('main', 'doc', or 'mini')")

    # compress
    parser_compress = subparsers.add_parser("compress", help="Compress a string")
    parser_compress.add_argument("string", type=str, help="String to compress")

    # decompress
    parser_decompress = subparsers.add_parser("decompress", help="Decompress a string")
    parser_decompress.add_argument("string", type=str, help="String to decompress")

    # get_char
    parser_get_char = subparsers.add_parser("get_char", help="Get char at index")
    parser_get_char.add_argument("string", type=str, help="Compressed string")
    parser_get_char.add_argument("index", type=int, help="Index")

    # set_char
    parser_set_char = subparsers.add_parser("set_char", help="Set char and update tracker")
    parser_set_char.add_argument("index", type=int, help="Index of character to change")
    parser_set_char.add_argument("new_char", type=str, help="New character")
    parser_set_char.add_argument("--output", type=str, required=True, help="Output tracker file")
    parser_set_char.add_argument("--key", type=str, required=True, help="Row key to update")

    # remove-file
    parser_remove = subparsers.add_parser("remove-file", help="Remove file from tracker")
    parser_remove.add_argument("file_path", type=str, help="File to remove")
    parser_remove.add_argument("--output", type=str, help="Output tracker file")

    # suggest-dependencies
    parser_suggest = subparsers.add_parser("suggest-dependencies", help="Suggest dependencies for a tracker")
    parser_suggest.add_argument("--tracker", type=str, required=True, help="Tracker file to analyze")
    parser_suggest.add_argument("--tracker_type", type=str, required=True, choices=["main", "doc", "mini"],
                                help="Type of the tracker file")

    # generate-embeddings
    parser_embed = subparsers.add_parser("generate-embeddings", help="Generate embeddings for files")
    parser_embed.add_argument("root_paths", type=str, nargs='+', help="Root directory paths")
    parser_embed.add_argument("--output", type=str, required=True, help="Output directory for embeddings")
    parser_embed.add_argument("--model", type=str, default="all-mpnet-base-v2", help="Name of the Sentence Transformer model")

    args = parser.parse_args()

    if args.command == "generate-keys":
        try:
            key_map, new_keys_added = generate_keys(args.root_paths)
            if args.output:
                update_tracker(args.output, key_map, args.tracker_type, sort_keys=new_keys_added)
            else:
                print("\n".join(f"{k}: {v}" for k, v in sorted(key_map.items())))
        except FileNotFoundError as e:
            print(f"Error: {e}")
            sys.exit(1)

    elif args.command == "compress":
        print(compress(args.string))

    elif args.command == "decompress":
        print(decompress(args.string))

    elif args.command == "get_char":
        try:
            print(get_char_at(args.string, args.index))
        except IndexError:
            print("Error: Index out of range")

    elif args.command == "set_char":
        if not os.path.exists(args.output):
            print(f"Error: File not found: {args.output}")
            sys.exit(1)
        if not isinstance(args.new_char, str) or len(args.new_char) != 1:
            print("Error: new_char must be a single character")
            sys.exit(1)

        with open(args.output, "r", encoding="utf-8") as f:
            lines = f.readlines()

        grid_start = "---GRID_START---"
        grid_end = "---GRID_END---"
        last_grid_edit = "last_GRID_edit"
        try:
            grid_start_index = lines.index(grid_start + "\n") + 1
            grid_end_index = lines.index(grid_end + "\n")
            x_axis_line = lines[grid_start_index]
            x_axis_keys = x_axis_line.strip().split(" ", 1)[1].split()
            num_columns = len(x_axis_keys)
        except ValueError:
            print("Error: Could not find grid in output file. Re-run 'generate-keys' to initialize the tracker.")
            sys.exit(1)

        try:
            diagonal_index = x_axis_keys.index(args.key)
        except ValueError:
            print(f"Error: Key '{args.key}' not found on X-axis.")
            sys.exit(1)

        if args.index == diagonal_index and args.new_char != "o":
            print(f"Error: Attempting to modify the diagonal 'o' character at index {args.index} for key {args.key}.")
            sys.exit(1)
        if args.index != diagonal_index and args.new_char == "o":
            print(f"Error: Attempt to set non-diagonal character to 'o' at index {args.index} for {args.key}")
            sys.exit(1)

        current_string = None
        for i in range(grid_start_index + 1, grid_end_index):
            if lines[i].startswith(f"{args.key} = "):
                match = re.match(r"(\w+) = (.*)", lines[i])
                if match:
                    current_string = match.group(2)
                break
        else:
            print(f"Error: Row with key '{args.key}' not found.")
            sys.exit(1)

        if current_string is None:
            print(f"Error: Could not read current string for key '{args.key}'.")
            sys.exit(1)

        new_string = set_char_at(current_string, args.index, args.new_char)

        for i in range(grid_start_index + 1, grid_end_index):
            if lines[i].startswith(f"{args.key} = "):
                if len(decompress(new_string)) != num_columns:
                    print(f"Error: Length mismatch. New string: {len(decompress(new_string))}, expected: {num_columns}")
                    sys.exit(1)
                lines[i] = f"{args.key} = {new_string}\n"
                break
        for i, line in enumerate(lines):
            if line.startswith(last_grid_edit):
                lines[i] = f"{last_grid_edit}: {args.key}\n"
                break

        with open(args.output, "w", encoding="utf-8") as f:
            f.writelines(lines)

    elif args.command == "remove-file":
        if not args.output:
            print("Error: --output file is required for remove-file.")
            sys.exit(1)
        try:
            remove_file_from_tracker(args.output, args.file_path)
        except (FileNotFoundError, ValueError) as e:
            print(f"Error: {e}")
            sys.exit(1)

    elif args.command == "suggest-dependencies":
        key_map = {}
        if os.path.exists(args.tracker):
            with open(args.tracker, "r", encoding="utf-8") as f:
                lines = f.readlines()
                existing_key_defs = _read_existing_keys(lines)
                key_map.update(existing_key_defs)
        else:
            print(f"Error: Tracker file '{args.tracker}' not found")
            sys.exit(1)
        suggestions = suggest_dependencies(args.tracker, args.tracker_type, key_map)
        print(json.dumps(suggestions, indent=4))
        update_tracker(args.tracker, key_map, args.tracker_type, suggestions, sort_keys=False)

    elif args.command == "generate-embeddings":
        generate_embeddings(args.root_paths, args.output, args.model)

    else:
        parser.print_help()

# Explicit blank line follows